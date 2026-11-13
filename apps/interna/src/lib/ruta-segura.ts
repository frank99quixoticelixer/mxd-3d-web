/**
 * Ruta a la que volver despues de iniciar sesion.
 *
 * Solo se acepta una ruta de este mismo sitio ("/catalogo/..."). Sin esta
 * comprobacion, un enlace a /login?siguiente=https://sitio-malo.example
 * convertiria el formulario en un redireccionador abierto: la persona entra con
 * su contrasena y termina en una pagina que imita al panel.
 */
export function rutaSegura(valor: FormDataEntryValue | string | null | undefined): string {
  if (typeof valor !== "string") return "/";
  // Debe empezar con una sola "/": "//host" y "/\host" los interpreta el
  // navegador como otro sitio.
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return "/";
  // Nada de saltos de linea ni caracteres de control que rompan la cabecera Location.
  if (/[\u0000-\u001f\u007f]/.test(valor)) return "/";
  // Volver a /login despues de entrar dejaria a la persona en un ciclo.
  if (valor === "/login" || valor.startsWith("/login?")) return "/";
  return valor;
}
