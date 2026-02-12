import os
import psycopg2
from dotenv import load_dotenv
from rich.console import Console
from rich.prompt import Prompt, Confirm

# Cargar variables de entorno desde la raíz del proyecto
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

console = Console()

def get_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'Facturas'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '')
    )

def main():
    console.print("[bold cyan]Resetear Tabla de Facturas[/bold cyan]\n")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Primero, ver cuántos registros hay
        cur.execute("SELECT COUNT(*) FROM facturas")
        total_actual = cur.fetchone()[0]
        console.print(f"Total registros actuales: [bold yellow]{total_actual}[/bold yellow]")
        
        año = Prompt.ask("Ingrese el Año (ej: 2026) [dim]o presione ENTER para resetear TODA la tabla[/dim]", default="")
        
        if not año:
            # TRUNCATE TOTAL
            confirmar = Confirm.ask("[bold red]¿Está seguro de que desea REINICIAR COMPLETAMENTE la tabla? (TRUNCATE)[/bold red]")
            if confirmar:
                cur.execute("TRUNCATE TABLE facturas RESTART IDENTITY;")
                conn.commit()
                console.print("[bold green]✓ Tabla reiniciada completamente.[/bold green]")
            else:
                console.print("[yellow]Operación cancelada.[/yellow]")
        else:
            mes = Prompt.ask(f"Ingrese el Mes (1-12) para {año} [dim]o presione ENTER para borrar TODO el año[/dim]", default="")
            
            if mes:
                # Borrar Mes y Año
                query = "DELETE FROM facturas WHERE EXTRACT(YEAR FROM fecha) = %s AND EXTRACT(MONTH FROM fecha) = %s"
                params = (año, mes)
                mensaje = f"Borrando facturas de {mes}/{año}..."
            else:
                # Borrar Solo Año
                query = "DELETE FROM facturas WHERE EXTRACT(YEAR FROM fecha) = %s"
                params = (año,)
                mensaje = f"Borrando todas las facturas del año {año}..."
            
            console.print(f"[cyan]{mensaje}[/cyan]")
            cur.execute(query, params)
            count = cur.rowcount
            conn.commit()
            console.print(f"[bold green]✓ Se eliminaron {count} registros.[/bold green]")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")

if __name__ == "__main__":
    main()
