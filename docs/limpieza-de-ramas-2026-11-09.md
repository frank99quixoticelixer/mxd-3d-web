# Limpieza de ramas, 9 de noviembre de 2026

Habia 9 ramas locales y 9 en GitHub. Quedaron 3 en GitHub (`main`, `Axel` y
`vitrina-visor-catalogo`) y, en local, `main`, `vitrina-visor-catalogo` y la de
trabajo del dia. Esta nota dice que se borro, por que era seguro y como
recuperar cualquier cosa.

## Regla desde ahora

Maximo **3 ramas vivas**: `main`, la que usa Axel y una de trabajo. Una rama se
borra cuando se mergea. Para que GitHub lo haga solo: Settings, General,
"Automatically delete head branches".

## Que se hizo

Antes de borrar nada se comparo cada rama con `origin/main`:

- **Sin commits propios** (todo su contenido ya estaba en `main`): se borraron.
- **Con commits propios**: se reviso si el contenido ya habia entrado por otra
  via, se rescato lo que servia y el resto se archivo con un tag.

| Rama | Estado | Que se hizo |
|------|--------|-------------|
| `dev-francisco` | todo en main | borrada (solo local) |
| `feature/catalogo-tren-aterrizaje` | todo en main | borrada, local y GitHub |
| `feature/landing-mx80` | todo en main | borrada, local y GitHub |
| `fix/perf-visor-hover-giro` | todo en main | borrada, local y GitHub |
| `explorador-inplace` | 1 commit sin integrar (campo PROVEEDOR) | rescatado a mano, tag, borrada |
| `feature/catalogo-fuselaje` | 1 commit redundante (los renders de los coples ya estaban en main) | tag, borrada |
| `fix/visor-pieza-catalogo` | 4 commits de experimentos de hover, obsoletos desde que se retiro el explorador (ADR 0001) | tag, borrada |

**No se tocaron** `origin/main`, `origin/Axel` ni `origin/vitrina-visor-catalogo`
(ni la copia local de esta ultima).

`main` local iba 39 commits atras y se adelanto a `origin/main`.

### El rescate

El commit del PROVEEDOR (`ca0d4db`) no se pudo recoger con `cherry-pick`: la
etiqueta de vitrina se borro y la ficha de interna cambio. Se reaplico a mano
solo en la etiqueta PDF de interna (`EtiquetaPieza.tsx`), porque la ficha web ya
traia el campo en `EtiquetaWeb.tsx`. Quedo en el commit `7937c6e`.

## Tags de respaldo

Son **locales**: viven en la maquina de Francisco y no se subieron a GitHub.

| Tag | Apunta a |
|-----|----------|
| `archivo/explorador-inplace-proveedor` | `ca0d4db` |
| `archivo/catalogo-fuselaje` | `20dd75f` |
| `archivo/fix-visor-pieza-catalogo` | `6924f10` |

Ver el contenido: `git log archivo/fix-visor-pieza-catalogo`. Volver a tener la
rama: `git branch fix/visor-pieza-catalogo archivo/fix-visor-pieza-catalogo`.

## Como recuperar una rama borrada

Todas se pueden volver a crear desde su ultimo commit, mientras el commit exista
en alguna copia (GitHub y `git reflog` lo guardan un tiempo, no para siempre):

```
git push origin <hash>:refs/heads/<nombre>     # en GitHub
git branch <nombre> <hash>                      # solo local
```

| Rama | Ultimo commit |
|------|---------------|
| `dev-francisco` | `e3ef849` |
| `explorador-inplace` | `ca0d4db` |
| `feature/catalogo-fuselaje` | `20dd75f` |
| `feature/catalogo-tren-aterrizaje` | `baaf9a2` |
| `feature/landing-mx80` | `8b193ab` |
| `fix/perf-visor-hover-giro` | `e4b488e` |
| `fix/visor-pieza-catalogo` | `6924f10` |

Las cuatro que estaban completas dentro de `main` (`dev-francisco`,
`feature/catalogo-tren-aterrizaje`, `feature/landing-mx80`,
`fix/perf-visor-hover-giro`) no pierden nada aunque no se recuperen: sus commits
son parte del historial de `main`.

## Copia de seguridad

Para guardar todo lo local (ramas y tags) en un solo archivo, fuera del repo:

```
git bundle create ..\mxd-3d-web-respaldo.bundle --all
```

No sirve un `git clone --mirror` para esto: traeria lo que hay hoy en GitHub y
ya no las ramas borradas.
