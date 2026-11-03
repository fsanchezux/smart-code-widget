import ts from 'typescript';

// uid → elemento JSX, usando el AST de TypeScript (nunca números de línea ni regex sobre el código).

export class ErrorAplicacion extends Error {}

export type ElementoJsx = ts.JsxElement | ts.JsxSelfClosingElement;

export function buscarPorUid(codigo: string, fichero: string, uid: string): ElementoJsx {
  const fuente = ts.createSourceFile(fichero, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const encontrados: ElementoJsx[] = [];

  const visitar = (nodo: ts.Node) => {
    if (ts.isJsxElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      const valor = atributo(apertura(nodo), 'data-uid')?.initializer;
      if (valor && ts.isStringLiteral(valor) && valor.text === uid) encontrados.push(nodo);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);

  if (encontrados.length === 0) throw new ErrorAplicacion(`No se encuentra data-uid="${uid}" en ${fichero}`);
  if (encontrados.length > 1) throw new ErrorAplicacion(`data-uid="${uid}" aparece ${encontrados.length} veces en ${fichero}`);
  return encontrados[0];
}

export function apertura(el: ElementoJsx): ts.JsxOpeningLikeElement {
  return ts.isJsxElement(el) ? el.openingElement : el;
}

export function atributo(el: ts.JsxOpeningLikeElement, nombre: string): ts.JsxAttribute | undefined {
  return el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === nombre,
  );
}

/** Código de la etiqueta de apertura del elemento con ese uid (`<button … >`). */
export function aperturaPorUid(codigo: string, fichero: string, uid: string): string {
  return apertura(buscarPorUid(codigo, fichero, uid)).getText();
}

/** Valor de un atributo escrito como literal ("..."); error si es una expresión. */
export function atributoLiteral(el: ElementoJsx, nombre: string): { valor: string; inicio: number; fin: number } | undefined {
  const attr = atributo(apertura(el), nombre);
  if (!attr?.initializer) return undefined;
  if (!ts.isStringLiteral(attr.initializer)) {
    throw new ErrorAplicacion(`${nombre} es una expresión; de momento solo se editan valores literales ("...")`);
  }
  return { valor: attr.initializer.text, inicio: attr.initializer.getStart(), fin: attr.initializer.getEnd() };
}

/** Texto hijo del elemento si es un único texto literal (sin {expresiones} ni elementos). */
export function textoLiteral(el: ElementoJsx): { valor: string; inicio: number; fin: number } {
  if (ts.isJsxSelfClosingElement(el)) throw new ErrorAplicacion('El elemento no tiene contenido de texto');
  const hijos = el.children.filter((h) => !(ts.isJsxText(h) && h.containsOnlyTriviaWhiteSpaces));
  const [texto] = hijos;
  if (hijos.length !== 1 || !ts.isJsxText(texto)) {
    throw new ErrorAplicacion('El contenido no es un texto literal (tiene expresiones o elementos); aún no se edita');
  }
  const crudo = texto.getFullText();
  const inicio = texto.pos + crudo.length - crudo.trimStart().length;
  const fin = texto.end - (crudo.length - crudo.trimEnd().length);
  return { valor: crudo.trim(), inicio, fin };
}
