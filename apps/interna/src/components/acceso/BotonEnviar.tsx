import { BOTON_PRINCIPAL, GIRANDO } from "./estilos";

/**
 * Boton de envio con circulo que gira mientras el servidor responde, para
 * /login y /registro.
 *
 * Esas paginas se ven sin sesion y el proxy NO deja pasar sus chunks de
 * JavaScript (proxy.ts), asi que no hay React en el navegador: ni useFormStatus
 * ni nada de cliente. El circulo lo enciende ScriptCarga, un script en linea,
 * al enviarse un <form data-con-carga>. Sin JavaScript el formulario envia
 * igual, solo que sin el circulo.
 *
 * Para paginas con sesion (que si cargan React) esta BotonEnviarEstado.
 */
export function BotonEnviar({
  texto,
  textoCargando,
}: {
  texto: string;
  textoCargando: string;
}) {
  return (
    <button
      type="submit"
      data-enviar
      className={`${BOTON_PRINCIPAL} inline-flex items-center justify-center gap-2`}
    >
      <span data-spinner aria-hidden="true" style={{ display: "none" }} className={GIRANDO} />
      <span data-texto data-texto-cargando={textoCargando}>
        {texto}
      </span>
    </button>
  );
}

const SCRIPT = `(function(){
  var fs=document.querySelectorAll('form[data-con-carga]');
  for(var n=0;n<fs.length;n++){(function(f){
    var enviando=false;
    var b=f.querySelector('[data-enviar]'); if(!b)return;
    var s=b.querySelector('[data-spinner]');
    var t=b.querySelector('[data-texto]');
    var original=t?t.textContent:'';
    function reponer(){
      enviando=false;
      b.removeAttribute('aria-busy'); b.style.opacity=''; b.style.cursor='';
      if(s)s.style.display='none';
      if(t)t.textContent=original;
    }
    f.addEventListener('submit',function(e){
      if(enviando){e.preventDefault();return;}
      enviando=true;
      b.setAttribute('aria-busy','true'); b.style.opacity='0.85'; b.style.cursor='progress';
      if(s)s.style.display='inline-block';
      if(t&&t.getAttribute('data-texto-cargando'))t.textContent=t.getAttribute('data-texto-cargando');
    });
    // Al volver con "atras" el navegador puede restaurar la pagina tal cual
    // estaba, con el circulo girando: se repone el boton.
    window.addEventListener('pageshow',function(ev){ if(ev.persisted)reponer(); });
  })(fs[n]);}
})();`;

/** Poner una sola vez por pagina, despues del formulario. */
export function ScriptCarga() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
