import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { obtenerAuth } from "@/lib/auth";

/**
 * Cierra la sesion de este navegador y manda a /login.
 *
 * Es una ruta y no una accion de servidor a proposito: el boton "Salir" es un
 * formulario HTML que recarga la pagina completa. Con la accion, el navegador
 * navegaba a /login desde JavaScript ya sin cookie, y el proxy responde 401 a
 * los chunks y a las peticiones de datos de quien no tiene sesion; si alguna de
 * esas peticiones salia mal, Next mostraba "This page couldn't load".
 *
 * proxy.ts deja pasar el POST sin sesion: quien ya caduco tambien tiene que
 * poder salir. Solo borra la cookie de quien la manda; la cookie es SameSite
 * lax, asi que otro sitio no puede cerrar la sesion de nadie.
 */
export async function POST() {
  const auth = obtenerAuth();
  if (auth) {
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // Sin sesion valida no hay nada que cerrar.
    }
  }

  // 303 para que el navegador pida /login con GET. Se arma con BETTER_AUTH_URL
  // por lo mismo que en proxy.ts: detras del proxy de Hostinger el host que ve
  // Node puede no ser el publico.
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3002";
  return NextResponse.redirect(new URL("/login", base), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}
