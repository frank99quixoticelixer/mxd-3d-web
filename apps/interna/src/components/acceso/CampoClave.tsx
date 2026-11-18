import { CAMPO_TEXTO } from "./estilos";

/**
 * Campo de contrasena con boton "Ver" / "Ocultar".
 *
 * /login y /registro se ven sin sesion, y el proxy NO deja pasar sus chunks de
 * JavaScript (proxy.ts), asi que aqui no puede haber componentes de cliente. El
 * boton lo agrega un script en linea (ScriptVerClave) a cada contenedor
 * [data-campo-clave]; sin JavaScript el campo sigue siendo un input normal.
 * El script en linea es el mismo recurso que ya usa el tema (lib/tema.ts).
 */
export function CampoClave({
  id,
  name,
  etiqueta,
  autoComplete,
  ayuda,
  minLength,
}: {
  id: string;
  name: string;
  etiqueta: string;
  autoComplete: "current-password" | "new-password";
  ayuda?: string;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-mxd-tinta">
        {etiqueta}
      </label>
      <div data-campo-clave className="relative">
        <input
          id={id}
          name={name}
          type="password"
          autoComplete={autoComplete}
          required
          minLength={minLength}
          maxLength={128}
          className={`${CAMPO_TEXTO} pr-20`}
        />
      </div>
      {ayuda && <span className="text-xs text-mxd-gris">{ayuda}</span>}
    </div>
  );
}

const SCRIPT = `(function(){
  var cs=document.querySelectorAll('[data-campo-clave]');
  for(var n=0;n<cs.length;n++){(function(c){
    var i=c.querySelector('input'); if(!i||c.querySelector('button'))return;
    var b=document.createElement('button');
    b.type='button'; b.textContent='Ver';
    b.setAttribute('aria-label','Mostrar contraseña'); b.setAttribute('aria-pressed','false');
    b.className='absolute right-1 top-1 bottom-1 rounded-md px-3 text-sm font-medium text-mxd-gris transition-colors hover:text-mxd-verde-oscuro active:bg-mxd-verde-claro';
    b.addEventListener('click',function(){
      var ver=i.type==='password';
      i.type=ver?'text':'password';
      b.textContent=ver?'Ocultar':'Ver';
      b.setAttribute('aria-pressed',ver?'true':'false');
      b.setAttribute('aria-label',ver?'Ocultar contraseña':'Mostrar contraseña');
      i.focus();
    });
    c.appendChild(b);
  })(cs[n]);}
})();`;

/** Poner una sola vez por pagina, despues del formulario. */
export function ScriptVerClave() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
