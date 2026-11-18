import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";

import { obtenerPool } from "@/lib/db";
import { exigirAdmin } from "@/lib/sesion";

import {
  activarCuenta,
  borrarCuenta,
  cambiarAdministrador,
  desactivarCuenta,
  rechazarSolicitud,
} from "./acciones";

export const metadata: Metadata = {
  title: "Usuarios",
  robots: { index: false, follow: false },
};

// Lee la base en cada peticion: una aprobacion debe verse al instante.
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  activada: "Cuenta activada. Ya puede entrar.",
  desactivada: "Cuenta desactivada y sus sesiones cerradas.",
  rechazada: "Solicitud rechazada. Si intenta entrar, verá que fue rechazada y podrá volver a solicitar.",
  borrada: "Cuenta borrada con todos sus datos.",
  "admin-dado": "Ahora es administrador.",
  "admin-quitado": "Ya no es administrador.",
  "ti-mismo": "No puedes hacerte eso a ti mismo.",
  "ultimo-admin": "Es el último administrador activo: no se puede desactivar ni quitarle la marca.",
  "no-aplica": "Esa acción no aplica a esta cuenta (solo a solicitudes o cuentas inactivas que no son de administrador).",
  invalido: "Petición no válida.",
};

type Cuenta = {
  id: string;
  email: string;
  name: string;
  empresa: string | null;
  activo: number;
  esAdmin: number;
  estado: string | null;
  createdAt: Date | string;
};

/** Las cuentas anteriores al campo `estado` no lo tienen: se deduce de `activo`. */
function estadoDe(c: Cuenta): "activa" | "pendiente" | "rechazada" | "baja" {
  if (c.activo) return "activa";
  if (c.estado === "rechazada" || c.estado === "baja") return c.estado;
  return "pendiente";
}

function fecha(valor: Date | string): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

const BOTON =
  "rounded-lg border border-mxd-borde px-3 py-1.5 text-sm font-medium text-mxd-tinta transition-all duration-75 hover:border-mxd-verde hover:text-mxd-verde-oscuro active:translate-y-0.5 active:scale-95 active:bg-mxd-verde-claro active:shadow-inner";
const BOTON_PELIGRO =
  "rounded-lg border border-mxd-borde px-3 py-1.5 text-sm font-medium text-red-600 transition-all duration-75 hover:border-red-600 active:translate-y-0.5 active:scale-95 active:bg-red-600/10 active:shadow-inner";

function Accion({
  id,
  accion,
  texto,
  peligro,
  extra,
}: {
  id: string;
  accion: (f: FormData) => Promise<void>;
  texto: string;
  peligro?: boolean;
  extra?: { name: string; value: string };
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      {extra && <input type="hidden" name={extra.name} value={extra.value} />}
      <button type="submit" className={peligro ? BOTON_PELIGRO : BOTON}>
        {texto}
      </button>
    </form>
  );
}

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  let yo: string;
  try {
    yo = (await exigirAdmin()).user.id;
  } catch {
    // Quien no es administrador no debe ni saber que la pagina existe.
    notFound();
  }

  const pool = obtenerPool();
  if (!pool) notFound();

  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, email, name, empresa, activo, esAdmin, estado, createdAt FROM `user` ORDER BY createdAt DESC",
  );
  const cuentas = filas as Cuenta[];
  const pendientes = cuentas.filter((c) => estadoDe(c) === "pendiente");
  const cerradas = cuentas.filter((c) => ["rechazada", "baja"].includes(estadoDe(c)));
  const activas = cuentas.filter((c) => c.activo);

  const { aviso } = await searchParams;
  const mensaje = aviso ? AVISOS[aviso] : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-mxd-tinta">Usuarios</h1>
        <p className="mt-1 text-sm text-mxd-gris">
          Aprueba solicitudes de acceso y gestiona las cuentas. Aprueba solo a
          quien reconozcas: el correo no se verifica.
        </p>
      </div>

      {mensaje && (
        <p role="status" className="rounded-lg border border-mxd-borde bg-mxd-verde-claro px-3 py-2 text-sm font-medium text-mxd-verde-oscuro">
          {mensaje}
        </p>
      )}

      <section aria-labelledby="pendientes">
        <h2 id="pendientes" className="text-lg font-semibold text-mxd-tinta">
          Solicitudes pendientes ({pendientes.length})
        </h2>
        <p className="text-sm text-mxd-gris">
          No entran hasta que las apruebes. Si rechazas una, la persona verá al
          intentar entrar que fue rechazada y podrá volver a solicitar.
        </p>
        {pendientes.length === 0 ? (
          <p className="mt-3 text-sm text-mxd-gris">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pendientes.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-mxd-borde p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-mxd-tinta">{c.name}</p>
                  <p className="break-all text-sm text-mxd-gris">{c.email}</p>
                  <p className="text-sm text-mxd-gris">
                    {c.empresa ? `${c.empresa} · ` : ""}
                    {fecha(c.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Accion id={c.id} accion={activarCuenta} texto="Aprobar" />
                  <Accion id={c.id} accion={rechazarSolicitud} texto="Rechazar" peligro />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="activas">
        <h2 id="activas" className="text-lg font-semibold text-mxd-tinta">
          Activas ({activas.length})
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {activas.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-mxd-borde p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-mxd-tinta">
                  {c.name}
                  {c.esAdmin ? (
                    <span className="ml-2 rounded bg-mxd-verde-claro px-2 py-0.5 text-xs font-semibold text-mxd-verde-oscuro">
                      Administrador
                    </span>
                  ) : null}
                  {c.id === yo ? <span className="ml-2 text-xs font-normal text-mxd-gris">(tú)</span> : null}
                </p>
                <p className="break-all text-sm text-mxd-gris">{c.email}</p>
                <p className="text-sm text-mxd-gris">
                  {c.empresa ? `${c.empresa} · ` : ""}
                  {fecha(c.createdAt)}
                </p>
              </div>
              {c.id !== yo && (
                <div className="flex flex-wrap gap-2">
                  {c.esAdmin ? (
                    <Accion id={c.id} accion={cambiarAdministrador} texto="Quitar administrador" extra={{ name: "admin", value: "0" }} />
                  ) : (
                    <Accion id={c.id} accion={cambiarAdministrador} texto="Hacer administrador" extra={{ name: "admin", value: "1" }} />
                  )}
                  <Accion id={c.id} accion={desactivarCuenta} texto="Desactivar" peligro />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {cerradas.length > 0 && (
        <section aria-labelledby="cerradas">
          <h2 id="cerradas" className="text-lg font-semibold text-mxd-tinta">
            Rechazadas y dadas de baja ({cerradas.length})
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {cerradas.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-mxd-borde p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-mxd-tinta">
                    {c.name}
                    <span className="ml-2 rounded bg-mxd-borde px-2 py-0.5 text-xs font-semibold text-mxd-gris">
                      {estadoDe(c) === "rechazada" ? "Rechazada" : "Dada de baja"}
                    </span>
                  </p>
                  <p className="break-all text-sm text-mxd-gris">{c.email}</p>
                  <p className="text-sm text-mxd-gris">
                    {c.empresa ? `${c.empresa} · ` : ""}
                    {fecha(c.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Accion id={c.id} accion={activarCuenta} texto={estadoDe(c) === "rechazada" ? "Aprobar" : "Reactivar"} />
                  {!c.esAdmin && <Accion id={c.id} accion={borrarCuenta} texto="Borrar" peligro />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
