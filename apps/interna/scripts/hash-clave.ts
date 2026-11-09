/**
 * Genera la entrada de una persona para INTERNA_USUARIOS.
 *
 *   npm run hash-clave -- ana
 *
 * Pide la contrasena dos veces SIN mostrarla (nunca va como argumento: se veria
 * en el historial del terminal y en la lista de procesos) e imprime una linea
 * `usuario:sal:hash`. Esa linea se agrega a INTERNA_USUARIOS en hPanel, separada
 * por coma de las demas, y se reinicia el sitio. La contrasena en claro no se
 * guarda en ningun lado: pasala a la persona por un canal aparte.
 *
 * Usa el mismo codigo que el proxy (src/lib/cuentas.ts), asi que los parametros
 * de scrypt no pueden quedar distintos.
 */
import { crearEntrada } from "../src/lib/cuentas";

const LARGO_MINIMO = 12;

/** Lee una linea del terminal sin repetir lo que se teclea. */
function pedirOculto(pregunta: string): Promise<string> {
  return new Promise((resolver) => {
    const entrada = process.stdin;
    process.stdout.write(pregunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");

    let texto = "";
    const alRecibir = (trozo: string) => {
      for (const caracter of trozo) {
        if (caracter === "\r" || caracter === "\n") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.removeListener("data", alRecibir);
          process.stdout.write("\n");
          resolver(texto);
          return;
        }
        if (caracter === "\u0003") {
          // Ctrl+C: en modo crudo el terminal ya no lo traduce a una senal.
          process.stdout.write("\n");
          process.exit(130);
        }
        if (caracter === "\u007f" || caracter === "\b") {
          texto = texto.slice(0, -1);
        } else {
          texto += caracter;
        }
      }
    };
    entrada.on("data", alRecibir);
  });
}

/** Sin terminal (por ejemplo con una tuberia): contrasena y confirmacion, una por linea. */
async function leerDeTuberia(): Promise<[string, string]> {
  let datos = "";
  for await (const trozo of process.stdin) datos += String(trozo);
  const [clave = "", confirmacion = ""] = datos.split(/\r?\n/);
  return [clave, confirmacion];
}

async function main() {
  const usuario = process.argv[2]?.trim().toLowerCase();
  if (!usuario) {
    console.error("Uso: npm run hash-clave -- <usuario>\n  ej.: npm run hash-clave -- ana");
    process.exit(1);
  }

  let clave: string;
  let confirmacion: string;
  if (process.stdin.isTTY) {
    clave = await pedirOculto(`Contrasena para ${usuario}: `);
    confirmacion = await pedirOculto("Repite la contrasena: ");
  } else {
    [clave, confirmacion] = await leerDeTuberia();
  }

  if (clave !== confirmacion) {
    console.error("\nLas dos contrasenas no coinciden. No se genero nada.");
    process.exit(1);
  }
  if (clave.length < LARGO_MINIMO) {
    console.error(`\nLa contrasena debe tener al menos ${LARGO_MINIMO} caracteres. No se genero nada.`);
    process.exit(1);
  }

  const entrada = await crearEntrada(usuario, clave);
  console.log(`
Entrada para ${usuario} (agregala a INTERNA_USUARIOS en hPanel, separada por coma
de las demas, y reinicia el sitio):

${entrada}
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
