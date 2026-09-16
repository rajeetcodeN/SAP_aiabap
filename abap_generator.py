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
from typing import Dict, Any, Tuple


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


class AbapGenerator:
    def __init__(self):
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.openai_key = os.getenv("OPENAI_API_KEY", "")
        self.gemini_key = os.getenv("GEMINI_API_KEY", "")

    def generate(self, requirement: str, class_name: str = "ZCL_ORDER_DISCOUNT", 
                 package_name: str = "$TMP", tables: str = "") -> Dict[str, Any]:
        """Generate Clean ABAP artifacts based on requirement and SAP context."""
        class_name = class_name.strip().upper() or "ZCL_CUSTOM_LOGIC"
        package_name = package_name.strip().upper() or "$TMP"

        # Check if an LLM key is configured
        if self.anthropic_key:
            return self._generate_with_anthropic(requirement, class_name, package_name, tables)
        elif self.gemini_key:
            return self._generate_with_gemini(requirement, class_name, package_name, tables)
        elif self.openai_key:
            return self._generate_with_openai(requirement, class_name, package_name, tables)
        else:
            # Fallback to intelligent template synthesizer for immediate zero-config operation
            return self._generate_template(requirement, class_name, package_name, tables)

    def _generate_with_anthropic(self, requirement: str, class_name: str, package_name: str, tables: str) -> Dict[str, Any]:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.anthropic_key)
            prompt = (
                f"Requirement: {requirement}\n"
                f"Class Name: {class_name}\n"
                f"Package: {package_name}\n"
                f"Target Tables: {tables}\n\n"
                "Generate the complete Clean ABAP 7.50+ class, unit tests, and abapGit XML."
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
            return self._generate_template(requirement, class_name, package_name, tables, fallback_reason=str(e))

    def _generate_with_gemini(self, requirement: str, class_name: str, package_name: str, tables: str) -> Dict[str, Any]:
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.gemini_key)
            model = genai.GenerativeModel("gemini-1.5-pro", system_instruction=CLEAN_ABAP_SYSTEM_PROMPT)
            prompt = (
                f"Requirement: {requirement}\n"
                f"Class Name: {class_name}\n"
                f"Package: {package_name}\n"
                f"Target Tables: {tables}\n"
            )
            response = model.generate_content(prompt)
            return self._parse_generated_output(response.text, class_name, package_name)
        except Exception as e:
            return self._generate_template(requirement, class_name, package_name, tables, fallback_reason=str(e))

    def _generate_with_openai(self, requirement: str, class_name: str, package_name: str, tables: str) -> Dict[str, Any]:
        try:
            import openai
            client = openai.OpenAI(api_key=self.openai_key)
            prompt = (
                f"Requirement: {requirement}\n"
                f"Class Name: {class_name}\n"
                f"Package: {package_name}\n"
                f"Target Tables: {tables}\n"
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
            return self._generate_template(requirement, class_name, package_name, tables, fallback_reason=str(e))

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
                           tables: str, fallback_reason: str = "") -> Dict[str, Any]:
        """Synthesize Clean ABAP code template dynamically from user inputs."""
        lower_cls = class_name.lower()
        method_name = "calculate"
        if "discount" in requirement.lower():
            method_name = "calculate_discount"
        elif "tax" in requirement.lower():
            method_name = "calculate_tax"
        elif "validate" in requirement.lower():
            method_name = "validate_order"

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
    rv_discount = COND #( WHEN iv_amount > c_threshold THEN c_discount
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
      exp = '10.00'
      msg = |Expected 10% discount for amounts over 1000| ).
  ENDMETHOD.

  METHOD test_below_threshold.
    DATA(lv_discount) = mo_cut->{method_name}( '500.00' ).
    cl_aunit_assert=>assert_equals(
      act = lv_discount
      exp = '0.00'
      msg = |Expected 0% discount for amounts under 1000| ).
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

        note = "Generated Clean ABAP code with inline declarations and unit tests."
        if fallback_reason:
            note += f" (Note: LLM fallback triggered: {fallback_reason[:80]})"

        return {
            "success": True,
            "mode": "template_synthesizer",
            "class_name": class_name,
            "package_name": package_name,
            "class_code": class_code,
            "test_code": test_code,
            "xml_code": xml_code,
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
