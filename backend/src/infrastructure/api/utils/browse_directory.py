import tkinter as tk
from tkinter import filedialog
import sys
import os

def select_folder():
    try:
        # Forzar que tkinter no use escalado de pantalla corrupto
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
        except:
            pass

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        folder_path = filedialog.askdirectory(title="Seleccionar carpeta de facturas")
        root.destroy()
        if folder_path:
            # Asegurarse de que se imprime en una sola línea limpia
            sys.stdout.write(os.path.normpath(folder_path))
            sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    select_folder()
