import os
from lxml import etree
import glob

def scan_xml_taxes(directory):
    xml_files = glob.glob(os.path.join(directory, "**/*.xml"), recursive=True)
    tax_schemes = set()
    other_charge_reasons = set()
    
    for file in xml_files:
        try:
            with open(file, 'rb') as f:
                content = f.read()
                if b'AttachedDocument' in content:
                    # Extraer el XML interno si existe
                    start_tag = b'<Invoice' if b'<Invoice' in content else b'<CreditNote'
                    end_tag = b'</Invoice>' if b'<Invoice' in content else b'</CreditNote>'
                    xml_start = content.find(start_tag)
                    xml_end = content.rfind(end_tag) + len(end_tag)
                    if xml_start != -1 and xml_end != -1:
                        content = content[xml_start:xml_end]
                
                root = etree.fromstring(content)
                # Buscar esquemas de impuestos
                schemes = root.xpath('//*[local-name()="TaxScheme"]')
                for s in schemes:
                    tid = s.xpath('./*[local-name()="ID"]/text()')
                    name = s.xpath('./*[local-name()="Name"]/text()')
                    if tid or name:
                        tax_schemes.add(f"{tid[0] if tid else '?'}: {name[0] if name else '?'}")
                
                # Buscar motivos de cargos/descuentos
                allowances = root.xpath('//*[local-name()="AllowanceCharge"]')
                for a in allowances:
                    indicator = a.xpath('./*[local-name()="ChargeIndicator"]/text()')
                    reason = a.xpath('./*[local-name()="AllowanceChargeReason"]/text()')
                    if reason:
                        type_str = "Cargo" if indicator and indicator[0] == 'true' else "Descuento"
                        other_charge_reasons.add(f"{type_str}: {reason[0]}")
                        
        except Exception as e:
            pass
            
    print("--- Tax Schemes Found ---")
    for s in sorted(tax_schemes):
        print(s)
    print("\n--- Charge/Allowance Reasons Found ---")
    for r in sorted(other_charge_reasons):
        print(r)

if __name__ == "__main__":
    scan_xml_taxes(r"F:\1. Cloud\4. AI\1. Antigravity\Facturas\Facturas")
