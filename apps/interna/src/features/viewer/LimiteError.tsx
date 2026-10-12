"use client";

import { Component, type ReactNode } from "react";

/**
 * Frontera de error para la carga del modelo 3D.
 *
 * Si el GLB no existe, esta corrupto o falla su decodificacion, en lugar de
 * romper toda la pagina se muestra el contenido de respaldo (el ensamble de
 * demostracion) y se registra el error en la consola.
 *
 * Debe ir DENTRO del <Canvas>, porque su hijo de respaldo son elementos 3D.
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
      "[MXD] No se pudo cargar el modelo 3D. Se muestra el ensamble de demostracion.",
      error,
    );
    this.props.alFallar?.(error);
  }

  render() {
    return this.state.fallo ? this.props.respaldo : this.props.children;
  }
}
