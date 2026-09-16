"""
ABAP Code Generator Engine.
Enforces Clean ABAP 7.50+ standards and generates complete abapGit-compatible artifacts:
- Main class definition and implementation (.clas.abap)
- Local ABAP Unit test class (.clas.locals_imp.abap)
- abapGit XML metadata (.clas.xml)
Supports direct LLM API (Anthropic / OpenAI / Gemini) or built-in offline template generator.
"""

import os
import re
import json
import requests
from typing import Dict, Any, Tuple, Optional, List


CLEAN_ABAP_SYSTEM_PROMPT = """
You are an expert SAP ABAP developer specializing in modern Clean ABAP 7.50+ / S/4HANA / ABAP Cloud.
Your task is to generate production-ready, clean, secure ABAP code.

MANDATORY CODING RULES:
1. Use inline declarations: DATA(var) = ...
2. Use constructor expressions: VALUE #(), COND #(), SWITCH #(), CORRESPONDING #().
3. Use string templates: |Total: { lv_amount }| instead of CONCATENATE.
4. Use table expressions: lt_table[ key = value ] instead of READ TABLE.
5. Avoid legacy Hungarian notation prefixes for local variables. Use clear, descriptive camelCase or snake_case identifiers.
6. Fail fast with custom or standard exception classes (CX_STATIC_CHECK) instead of sy-subrc integers.
7. Always provide an ABAP Unit test class (FOR TESTING) in the locals_imp section using CL_AUNIT_ASSERT.
8. Structure code for abapGit:
   - Part 1: Main Global Class Definition & Implementation (src/<class_name>.clas.abap)
   - Part 2: Local Test Class (src/<class_name>.clas.locals_imp.abap)
   - Part 3: abapGit XML Metadata (src/<class_name>.clas.xml)

Output your response with distinct delimiters:
===CLASS_START===
<ABAP main class code>
===CLASS_END===

===TEST_START===
<ABAP local test class code>
===TEST_END===

===XML_START===
<abapGit XML metadata>
===XML_END===
"""


def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k:
                        os.environ[k] = v
_load_env()


class AbapGenerator:
    def __init__(self):
        _load_env()
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.openai_key = os.getenv("OPENAI_API_KEY", "")
        self.gemini_key = os.getenv("GEMINI_API_KEY", "")

    def analyze_and_clarify(self, requirement: str, object_type: str = "class", 
                            class_name: str = "") -> Dict[str, Any]:
        """Analyze a requirement for business ambiguities, edge cases, and ask clarifying questions."""
        req_lower = requirement.lower()
        
        # Detect threshold or numeric boundary using contextual keywords
        is_below = "below" in req_lower or "less" in req_lower or "under" in req_lower
        is_above = "above" in req_lower or "greater" in req_lower or "over" in req_lower or "exceed" in req_lower
        
        kw_match = re.search(r'(?:below|under|less\s+than|above|over|greater\s+than|exceeds?|amount\s*(?:of|is)?)\s*(\d+(?:\.\d+)?)', requirement, re.IGNORECASE)
        if kw_match:
            num_val = kw_match.group(1)
        else:
            numbers = [int(x) for x in re.findall(r'\b\d+\b(?!\s*%)', requirement)]
            num_val = str(max(numbers)) if numbers else "1000"
        
        questions = []
        
        # Boundary question
        if is_below:
            questions.append({
                "id": "q_boundary",
                "category": "Boundary Condition",
                "question": f"For threshold {num_val}, is the boundary condition inclusive or exclusive?",
                "options": [
                    f"Inclusive: Amount <= {num_val} qualifies",
                    f"Exclusive: Amount < {num_val} qualifies"
                ],
                "default": f"Inclusive: Amount <= {num_val} qualifies"
            })
        elif is_above:
            questions.append({
                "id": "q_boundary",
                "category": "Boundary Condition",
                "question": f"For threshold {num_val}, is the boundary condition inclusive or exclusive?",
                "options": [
                    f"Exclusive: Amount > {num_val} qualifies",
                    f"Inclusive: Amount >= {num_val} qualifies"
                ],
                "default": f"Exclusive: Amount > {num_val} qualifies"
            })
        else:
            questions.append({
                "id": "q_boundary",
                "category": "Boundary Condition",
                "question": "How should boundary conditions and equality comparisons be evaluated?",
                "options": [
                    "Strict inequality (< or >)",
                    "Inclusive boundary (<= or >=)"
                ],
                "default": "Inclusive boundary (<= or >=)"
            })
            
        # Exception / Negative amount question
        questions.append({
            "id": "q_exceptions",
            "category": "Error & Exception Handling",
            "question": "How should negative or mathematically invalid inputs be handled?",
            "options": [
                "Raise CX_SY_CONVERSION_OVERFLOW exception (Fail fast, Clean ABAP)",
                "Return 0.00 / initial value silently",
                "Return custom CX_STATIC_CHECK application exception"
            ],
            "default": "Raise CX_SY_CONVERSION_OVERFLOW exception (Fail fast, Clean ABAP)"
        })
        
        # Data type and precision question
        questions.append({
            "id": "q_types",
            "category": "Data Type & Precision",
            "question": "What numeric data type and precision should be used?",
            "options": [
                "Packed decimal 15 dec 2 (Standard p LENGTH 15 DECIMALS 2)",
                "Floating point (f)",
                "Currency-referenced field"
            ],
            "default": "Packed decimal 15 dec 2 (Standard p LENGTH 15 DECIMALS 2)"
        })
        
        # Security authorization
        questions.append({
            "id": "q_auth",
            "category": "Security & Authorizations",
            "question": "Does this method or report require an SAP authorization check?",
            "options": [
                "No authorization check needed ($TMP / internal helper)",
                "Enforce AUTHORITY-CHECK on authorization object"
            ],
            "default": "No authorization check needed ($TMP / internal helper)"
        })
        
        edge_cases = [
            f"Zero input boundary (0.00)",
            f"Negative input values (-50.00)",
            f"Exact threshold evaluation at {num_val}",
            f"High volume precision calculation"
        ]
        
        return {
            "success": True,
            "summary": f"Analyzed {object_type.upper()} requirement: '{requirement[:75]}...'. Formulated 4 technical clarification questions and identified 4 edge cases.",
            "questions": questions,
            "detected_edge_cases": edge_cases,
            "suggested_scenarios": [
                f"Valid input satisfying condition",
                f"Valid input not satisfying condition",
                f"Exact boundary threshold at {num_val}",
                f"Negative value validation"
            ]
        }

    def generate(self, requirement: str, class_name: str = "ZCL_ORDER_DISCOUNT", 
                 package_name: str = "$TMP", tables: str = "", object_type: str = 'class',
                 test_scenarios: str = "",
                 clarification_answers: Optional[Dict[str, str]] = None,
                 error_feedback: str = "") -> Dict[str, Any]:
        """Generate Clean ABAP artifacts based on requirement, clarifications, test scenarios, and SAP context."""
        class_name = class_name.strip().upper() or "ZCL_CUSTOM_LOGIC"
        package_name = package_name.strip().upper() or "$TMP"
        if clarification_answers is None:
            clarification_answers = {}

        if error_feedback:
            requirement = f"{requirement}\n[FIX COMPILER/TEST ERRORS]: {error_feedback}"

        # Check if an LLM key is configured
        if self.anthropic_key:
            return self._generate_with_anthropic(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers)
        elif self.gemini_key:
            return self._generate_with_gemini(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers)
        elif self.openai_key:
            return self._generate_with_openai(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers)
        else:
            # Fallback to intelligent template synthesizer for immediate zero-config operation
            return self._generate_template(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers)

    def _generate_with_anthropic(self, requirement: str, class_name: str, package_name: str, tables: str, object_type: str, test_scenarios: str = "", clarification_answers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.anthropic_key)
            test_prompt = f"\nSpecific Test Scenarios to Implement:\n{test_scenarios}\n" if test_scenarios else ""
            clarify_prompt = ""
            if clarification_answers:
                clarify_prompt = "\nConfirmed Architectural Decisions:\n" + "\n".join([f"- {k}: {v}" for k, v in clarification_answers.items()]) + "\n"
            prompt = (
                f"Requirement: {requirement}\n"
                f"Class Name: {class_name}\n"
                f"Package: {package_name}\n"
                f"Target Tables: {tables}\n"
                f"Object Type: {object_type}\n"
                f"{clarify_prompt}"
                f"{test_prompt}\n"
                "Generate the complete Clean ABAP 7.50+ class, comprehensive ABAP Unit tests covering all specified test scenarios with CL_AUNIT_ASSERT, and abapGit XML."
            )
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4000,
                system=CLEAN_ABAP_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.content[0].text
            return self._parse_generated_output(content, class_name, package_name)
        except Exception as e:
            return self._generate_template(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers, fallback_reason=str(e))

    def _generate_with_gemini(self, requirement: str, class_name: str, package_name: str, tables: str, object_type: str, test_scenarios: str = "", clarification_answers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        test_prompt = f"\nSpecific Test Scenarios to Implement:\n{test_scenarios}\n" if test_scenarios else ""
        clarify_prompt = ""
        if clarification_answers:
            clarify_prompt = "\nConfirmed Architectural Decisions:\n" + "\n".join([f"- {k}: {v}" for k, v in clarification_answers.items()]) + "\n"
        prompt = (
            f"Requirement: {requirement}\n"
            f"Class Name: {class_name}\n"
            f"Package: {package_name}\n"
            f"Target Tables: {tables}\n"
            f"Object Type: {object_type}\n"
            f"{clarify_prompt}"
            f"{test_prompt}\n"
            "Generate the complete Clean ABAP 7.50+ class, comprehensive ABAP Unit tests covering all specified test scenarios with CL_AUNIT_ASSERT, and abapGit XML."
        )
        model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": f"{CLEAN_ABAP_SYSTEM_PROMPT}\n\n{prompt}"}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096}
        }
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=25)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return self._parse_generated_output(text, class_name, package_name)
            else:
                return self._generate_template(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers,
                                              fallback_reason=f"Gemini API returned HTTP {res.status_code}: {res.text[:150]}")
        except Exception as e:
            return self._generate_template(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers, fallback_reason=str(e))

    def _generate_with_openai(self, requirement: str, class_name: str, package_name: str, tables: str, object_type: str, test_scenarios: str = "", clarification_answers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        try:
            import openai
            client = openai.OpenAI(api_key=self.openai_key)
            test_prompt = f"\nSpecific Test Scenarios to Implement:\n{test_scenarios}\n" if test_scenarios else ""
            clarify_prompt = ""
            if clarification_answers:
                clarify_prompt = "\nConfirmed Architectural Decisions:\n" + "\n".join([f"- {k}: {v}" for k, v in clarification_answers.items()]) + "\n"
            prompt = (
                f"Requirement: {requirement}\n"
                f"Class Name: {class_name}\n"
                f"Package: {package_name}\n"
                f"Target Tables: {tables}\n"
                f"Object Type: {object_type}\n"
                f"{clarify_prompt}"
                f"{test_prompt}\n"
            )
            res = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": CLEAN_ABAP_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ]
            )
            return self._parse_generated_output(res.choices[0].message.content, class_name, package_name)
        except Exception as e:
            return self._generate_template(requirement, class_name, package_name, tables, object_type, test_scenarios, clarification_answers, fallback_reason=str(e))

    def _parse_generated_output(self, content: str, class_name: str, package_name: str) -> Dict[str, Any]:
        class_match = re.search(r"===CLASS_START===(.*?)===CLASS_END===", content, re.DOTALL)
        test_match = re.search(r"===TEST_START===(.*?)===TEST_END===", content, re.DOTALL)
        xml_match = re.search(r"===XML_START===(.*?)===XML_END===", content, re.DOTALL)

        class_code = class_match.group(1).strip() if class_match else content.strip()
        test_code = test_match.group(1).strip() if test_match else self._default_test_code(class_name)
        xml_code = xml_match.group(1).strip() if xml_match else self._default_xml_code(class_name, package_name)

        return {
            "success": True,
            "mode": "ai_generated",
            "class_name": class_name,
            "package_name": package_name,
            "class_code": class_code,
            "test_code": test_code,
            "xml_code": xml_code,
            "explanation": "Successfully generated Clean ABAP class with unit tests following modern 7.50+ standards."
        }

    def _generate_template(self, requirement: str, class_name: str, package_name: str, 
                           tables: str, object_type: str = 'class', test_scenarios: str = "",
                           clarification_answers: Optional[Dict[str, str]] = None,
                           fallback_reason: str = "") -> Dict[str, Any]:
        """Synthesize Clean ABAP code template dynamically from user inputs and test scenarios."""
        if clarification_answers is None:
            clarification_answers = {}

        if object_type == 'report':
            return self._generate_report_template(requirement, class_name, package_name, tables, fallback_reason)
        elif object_type == 'interface':
            return self._generate_interface_template(requirement, class_name, package_name, fallback_reason)
        elif object_type == 'function_module':
            return self._generate_fugr_template(requirement, class_name, package_name, tables, fallback_reason)
        elif object_type == 'cds_view':
            return self._generate_cds_template(requirement, class_name, package_name, tables, fallback_reason)
        elif object_type == 'badi':
            return self._generate_badi_template(requirement, class_name, package_name, fallback_reason)

        lower_cls = class_name.lower()
        method_name = "calculate"
        req_lower = requirement.lower()
        if "discount" in req_lower:
            method_name = "calculate_discount"
        elif "tax" in req_lower:
            method_name = "calculate_tax"
        elif "validate" in req_lower:
            method_name = "validate_order"

        # Determine condition direction and boundary
        is_below = "below" in req_lower or "less" in req_lower or "under" in req_lower
        boundary_ans = str(clarification_answers.get("q_boundary", "")).lower()
        
        if is_below:
            op = "<" if "exclusive" in boundary_ans else "<="
            exp_below = "10.00"
            exp_above = "0.00"
        else:
            op = ">=" if "inclusive" in boundary_ans else ">"
            exp_below = "0.00"
            exp_above = "10.00"

        class_code = f"""CLASS {lower_cls} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb OPTIONAL.

    TYPES:
      tv_amount   TYPE p LENGTH 15 DECIMALS 2,
      tv_discount TYPE p LENGTH 5 DECIMALS 2.

    METHODS {method_name}
      IMPORTING
        iv_amount          TYPE tv_amount
      RETURNING
        VALUE(rv_discount) TYPE tv_discount
      RAISING
        cx_sy_conversion_overflow.

  PROTECTED SECTION.
  PRIVATE SECTION.
    CONSTANTS:
      c_threshold TYPE tv_amount VALUE '1000.00',
      c_discount  TYPE tv_discount VALUE '10.00'.
ENDCLASS.

CLASS {lower_cls} IMPLEMENTATION.
  METHOD {method_name}.
    " Clean ABAP: Fail fast on invalid boundaries
    IF iv_amount < 0.
      RAISE EXCEPTION TYPE cx_sy_conversion_overflow.
    ENDIF.

    " Clean ABAP: COND expression replacing verbose IF-ELSE
    rv_discount = COND #( WHEN iv_amount {op} c_threshold THEN c_discount
                          ELSE '0.00' ).
  ENDMETHOD.
ENDCLASS.
"""

        test_code = f"""CLASS ltcl_{lower_cls}_test DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    DATA mo_cut TYPE REF TO {lower_cls}.

    METHODS setup.
    METHODS test_above_threshold FOR TESTING.
    METHODS test_below_threshold FOR TESTING.
    METHODS test_zero_amount     FOR TESTING.
    METHODS test_negative_amount FOR TESTING.
ENDCLASS.

CLASS ltcl_{lower_cls}_test IMPLEMENTATION.
  METHOD setup.
    mo_cut = NEW #( ).
  ENDMETHOD.

  METHOD test_above_threshold.
    DATA(lv_discount) = mo_cut->{method_name}( '1500.00' ).
    cl_aunit_assert=>assert_equals(
      act = lv_discount
      exp = '{exp_above}'
      msg = |Expected {exp_above} discount for amounts over 1000| ).
  ENDMETHOD.

  METHOD test_below_threshold.
    DATA(lv_discount) = mo_cut->{method_name}( '500.00' ).
    cl_aunit_assert=>assert_equals(
      act = lv_discount
      exp = '{exp_below}'
      msg = |Expected {exp_below} discount for amounts under 1000| ).
  ENDMETHOD.

  METHOD test_zero_amount.
    DATA(lv_discount) = mo_cut->{method_name}( '0.00' ).
    cl_aunit_assert=>assert_equals(
      act = lv_discount
      exp = '0.00'
      msg = |Expected 0% discount for zero amount| ).
  ENDMETHOD.

  METHOD test_negative_amount.
    TRY.
        mo_cut->{method_name}( '-50.00' ).
        cl_aunit_assert=>fail( msg = |Negative amount must raise exception| ).
      CATCH cx_sy_conversion_overflow.
        " Expected outcome
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
"""

        xml_code = self._default_xml_code(class_name, package_name)

        files = [
            {'name': f'{lower_cls}.clas.abap', 'content': class_code, 'type': 'source'},
            {'name': f'{lower_cls}.clas.locals_imp.abap', 'content': test_code, 'type': 'test'},
            {'name': f'{lower_cls}.clas.xml', 'content': xml_code, 'type': 'metadata'}
        ]

        note = "Generated Clean ABAP code with inline declarations and unit tests."
        if fallback_reason:
            note += f" (Note: LLM fallback triggered: {fallback_reason[:80]})"

        return {
            "success": True,
            "mode": "template_synthesizer",
            "object_type": "class",
            "class_name": class_name,
            "package_name": package_name,
            "class_code": class_code,
            "test_code": test_code,
            "xml_code": xml_code,
            "files": files,
            "explanation": note
        }

    def _default_test_code(self, class_name: str) -> str:
        lower_cls = class_name.lower()
        return f"""CLASS ltcl_{lower_cls}_test DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    DATA mo_cut TYPE REF TO {lower_cls}.
    METHODS setup.
    METHODS test_execution FOR TESTING.
ENDCLASS.

CLASS ltcl_{lower_cls}_test IMPLEMENTATION.
  METHOD setup.
    mo_cut = NEW #( ).
  ENDMETHOD.

  METHOD test_execution.
    cl_aunit_assert=>assert_bound(
      act = mo_cut
      msg = |Object instantiation verified| ).
  ENDMETHOD.
ENDCLASS.
"""

    def _default_xml_code(self, class_name: str, package_name: str) -> str:
        return f"""<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_CLAS" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <VSEOCLASS>
    <CLSNAME>{class_name.upper()}</CLSNAME>
    <LANGU>E</LANGU>
    <DESCRIPT>Clean ABAP generated class</DESCRIPT>
    <STATE>1</STATE>
    <CLSCCINCL>X</CLSCCINCL>
    <FIXPT>X</FIXPT>
    <UNICODE>X</UNICODE>
   </VSEOCLASS>
  </asx:values>
 </asx:abap>
</abapGit>
"""

    def _generate_report_template(self, requirement, class_name, package_name, tables, fallback_reason=''):
        prog_name = class_name.lower()
        source = f"""REPORT {prog_name}.

* Selection screen
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.
  PARAMETERS: p_input TYPE string.
SELECTION-SCREEN END OF BLOCK b1.

INITIALIZATION.
  TEXT-001 = 'Input Parameters'.

START-OF-SELECTION.
  DATA(result) = |Processed: {{ p_input }}|.
  WRITE: / result.
"""
        xml = f"""<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_PROG" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <PROGDIR>
    <NAME>{class_name.upper()}</NAME>
    <DBAPL>S</DBAPL>
    <DBNA>D$</DBNA>
    <SUBC>1</SUBC>
    <FIXPT>X</FIXPT>
    <LDBNAME></LDBNAME>
    <UCCHECK>X</UCCHECK>
   </PROGDIR>
  </asx:values>
 </asx:abap>
</abapGit>
"""
        note = 'Generated ABAP Report program.'
        if fallback_reason:
            note += f' (LLM fallback: {fallback_reason[:80]})'
        return {
            'success': True, 'mode': 'template_synthesizer',
            'object_type': 'report', 'class_name': class_name, 'package_name': package_name,
            'class_code': source, 'test_code': '', 'xml_code': xml,
            'files': [
                {'name': f'{prog_name}.prog.abap', 'content': source, 'type': 'source'},
                {'name': f'{prog_name}.prog.xml', 'content': xml, 'type': 'metadata'}
            ],
            'explanation': note
        }

    def _generate_interface_template(self, requirement, class_name, package_name, fallback_reason=''):
        intf_name = class_name.lower()
        source = f"""INTERFACE {intf_name}
  PUBLIC.

  TYPES:
    tv_result TYPE string.

  METHODS execute
    IMPORTING
      iv_input       TYPE string
    RETURNING
      VALUE(rv_result) TYPE tv_result
    RAISING
      cx_static_check.

ENDINTERFACE.
"""
        xml = f"""<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_INTF" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <VSEOINTERF>
    <CLSNAME>{class_name.upper()}</CLSNAME>
    <LANGU>E</LANGU>
    <DESCRIPT>Clean ABAP generated interface</DESCRIPT>
    <EXPOSURE>2</EXPOSURE>
    <STATE>1</STATE>
    <UNICODE>X</UNICODE>
   </VSEOINTERF>
  </asx:values>
 </asx:abap>
</abapGit>
"""
        note = 'Generated ABAP Interface.'
        if fallback_reason:
            note += f' (LLM fallback: {fallback_reason[:80]})'
        return {
            'success': True, 'mode': 'template_synthesizer',
            'object_type': 'interface', 'class_name': class_name, 'package_name': package_name,
            'class_code': source, 'test_code': '', 'xml_code': xml,
            'files': [
                {'name': f'{intf_name}.intf.abap', 'content': source, 'type': 'source'},
                {'name': f'{intf_name}.intf.xml', 'content': xml, 'type': 'metadata'}
            ],
            'explanation': note
        }

    def _generate_fugr_template(self, requirement, class_name, package_name, tables, fallback_reason=''):
        fugr_name = class_name.lower()
        fm_name = f'Z_FM_{class_name.upper().replace("Z", "", 1)}' if class_name.upper().startswith('Z') else f'Z_FM_{class_name.upper()}'
        source = f"""FUNCTION {fm_name.lower()}.
*"----------------------------------------------------------------------
*"  IMPORTING
*"     VALUE(IV_INPUT) TYPE STRING
*"  EXPORTING
*"     VALUE(EV_RESULT) TYPE STRING
*"  RAISING
*"     CX_STATIC_CHECK
*"----------------------------------------------------------------------
  ev_result = |Processed: {{ iv_input }}|.
ENDFUNCTION.
"""
        xml = f"""<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_FUGR" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <FUGR>
    <AREAT>Clean ABAP generated function group</AREAT>
    <INCLUDES>
     <SOBJ_NAME>{fugr_name.upper()}TOP</SOBJ_NAME>
    </INCLUDES>
    <FUNCTIONS>
     <item>
      <FUNCNAME>{fm_name}</FUNCNAME>
      <SHORT_TEXT>Generated function module</SHORT_TEXT>
     </item>
    </FUNCTIONS>
   </FUGR>
  </asx:values>
 </asx:abap>
</abapGit>
"""
        note = 'Generated ABAP Function Module in Function Group.'
        if fallback_reason:
            note += f' (LLM fallback: {fallback_reason[:80]})'
        return {
            'success': True, 'mode': 'template_synthesizer',
            'object_type': 'function_module', 'class_name': class_name, 'package_name': package_name,
            'class_code': source, 'test_code': '', 'xml_code': xml,
            'files': [
                {'name': f'{fugr_name}.fugr.{fm_name.lower()}.abap', 'content': source, 'type': 'source'},
                {'name': f'{fugr_name}.fugr.xml', 'content': xml, 'type': 'metadata'}
            ],
            'explanation': note
        }

    def _generate_cds_template(self, requirement, class_name, package_name, tables, fallback_reason=''):
        view_name = class_name.upper()
        table_list = [t.strip() for t in tables.split(',') if t.strip()]
        base_table = table_list[0] if table_list else 'MARA'
        source = f"""@AbapCatalog.sqlViewName: '{view_name}V'
@AbapCatalog.compiler.compareFilter: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Generated CDS View'
define view {view_name}
  as select from {base_table.lower()}
{{
  key mandt,
  key matnr,
  mtart,
  matkl
}}
"""
        xml = f"""<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_DDLS" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <DDLS>
    <DDLNAME>{view_name}</DDLNAME>
    <DDLANGUAGE>E</DDLANGUAGE>
    <DDTEXT>Generated CDS View</DDTEXT>
   </DDLS>
  </asx:values>
 </asx:abap>
</abapGit>
"""
        note = 'Generated CDS View definition.'
        if fallback_reason:
            note += f' (LLM fallback: {fallback_reason[:80]})'
        return {
            'success': True, 'mode': 'template_synthesizer',
            'object_type': 'cds_view', 'class_name': class_name, 'package_name': package_name,
            'class_code': source, 'test_code': '', 'xml_code': xml,
            'files': [
                {'name': f'{view_name.lower()}.ddls.asddls', 'content': source, 'type': 'source'},
                {'name': f'{view_name.lower()}.ddls.xml', 'content': xml, 'type': 'metadata'}
            ],
            'explanation': note
        }

    def _generate_badi_template(self, requirement, class_name, package_name, fallback_reason=''):
        impl_class = class_name.lower()
        source = f"""CLASS {impl_class} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_badi_interface.

    METHODS if_badi_interface~execute
      IMPORTING
        iv_input       TYPE string
      EXPORTING
        ev_result      TYPE string.

  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS {impl_class} IMPLEMENTATION.
  METHOD if_badi_interface~execute.
    ev_result = |BAdI processed: {{ iv_input }}|.
  ENDMETHOD.
ENDCLASS.
"""
        xml = self._default_xml_code(class_name, package_name)
        test_code = self._default_test_code(class_name)
        note = 'Generated BAdI Implementation class.'
        if fallback_reason:
            note += f' (LLM fallback: {fallback_reason[:80]})'
        return {
            'success': True, 'mode': 'template_synthesizer',
            'object_type': 'badi', 'class_name': class_name, 'package_name': package_name,
            'class_code': source, 'test_code': test_code, 'xml_code': xml,
            'files': [
                {'name': f'{impl_class}.clas.abap', 'content': source, 'type': 'source'},
                {'name': f'{impl_class}.clas.locals_imp.abap', 'content': test_code, 'type': 'test'},
                {'name': f'{impl_class}.clas.xml', 'content': xml, 'type': 'metadata'}
            ],
            'explanation': note
        }
