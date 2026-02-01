import sys
import re

def extract_strings(filename):
    try:
        with open(filename, 'rb') as f:
            content = f.read()
        # Naive string extraction since we don't know if pypdf is installed
        # Most PDFs have some plain text or FlateDecode. 
        # If compressed, this won't show much, but it's worth a try for numbers.
        text = content.decode('latin-1', errors='ignore')
        
        # Look for numbers matching the XML values
        targets = [
            "852030", "852.030", "852,030",
            "3937", "3.937", "3,937",
            "715991", "715.991", "715,991",
            "136038", "136.038", "136,038",
            "Retenc", "Total", "Pagar"
        ]
        
        print("--- Finding relevant strings in PDF ---")
        # Simple sliding window or line check won't work well with binary streams 
        # but often PDF text segments are () delimited or stream...endstream.
        # We'll just print lines that contain our targets after cleaning garbage.
        
        # Extract things that look like text inside parentheses (PDF format)
        # or just raw strings if not fully compressed.
        
        matches = []
        # pattern for PDF text objects: (text)
        pdf_strings = re.findall(r'\((.*?)\)', text)
        for s in pdf_strings:
            if any(t in s for t in targets):
                matches.append(s)
                
        # Also check raw text just in case
        lines = text.split('\n')
        for line in lines:
            if any(t in line for t in targets):
                # Clean up binary chars
                clean = "".join(c for c in line if 31 < ord(c) < 127)
                if len(clean) > 5 and clean not in matches:
                     matches.append(clean)

        for m in set(matches):
            print(f"Match: {m}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_strings(sys.argv[1])
