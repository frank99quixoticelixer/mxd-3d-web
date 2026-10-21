"use client";

import { Component, type ReactNode } from "react";

/**
 * Frontera de error para la carga del modelo 3D.
 *
 * Si el GLB no existe, esta corrupto o falla su decodificacion, o si el
 * navegador no puede crear el contexto WebGL, en lugar de romper toda la
 * pagina se muestra el contenido de respaldo y se registra el error en la
 * consola.
 *
 * Dentro del <Canvas> el respaldo tiene que ser 3D (o un <Html> de drei);
 * fuera de el, HTML normal.
 */
export class LimiteError extends Component<
  { children: ReactNode; respaldo: ReactNode; alFallar?: (e: Error) => void },
  { fallo: boolean }
> {
  constructor(props: {
    children: ReactNode;
    respaldo: ReactNode;
    alFallar?: (e: Error) => void;
  }) {
    super(props);
    this.state = { fallo: false };
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: Error) {
    console.error(
      "[MXD] No se pudo mostrar el modelo 3D.",
      error,
    );
    this.props.alFallar?.(error);
  }

  render() {
    return this.state.fallo ? this.props.respaldo : this.props.children;
  }
}
