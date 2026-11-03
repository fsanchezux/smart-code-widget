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

export interface TextoEditable {
  valor: string;
  inicio: number;
  fin: number;
  /** Cómo escribir un texto nuevo en ese hueco (JSX o literal de cadena). */
  escribir(nuevo: string): string;
}

/**
 * Texto del elemento, para la prop `texto`:
 * - texto literal hijo: `<h1>Hola</h1>`;
 * - o `{variable}` cuyo valor inicial es un texto fijo: `const [titulo] = useState('Hola')` o `const titulo = 'Hola'`
 *   (se edita ese valor inicial).
 */
export function textoLiteral(el: ElementoJsx): TextoEditable {
  if (ts.isJsxSelfClosingElement(el)) throw new ErrorAplicacion('El elemento no tiene contenido de texto');
  const hijos = el.children.filter((h) => !(ts.isJsxText(h) && h.containsOnlyTriviaWhiteSpaces));
  const [hijo] = hijos;
  if (hijos.length === 1 && ts.isJsxText(hijo)) {
    const crudo = hijo.getFullText();
    const inicio = hijo.pos + crudo.length - crudo.trimStart().length;
    const fin = hijo.end - (crudo.length - crudo.trimEnd().length);
    return { valor: crudo.trim(), inicio, fin, escribir: (n) => (/[{}<>]/.test(n) ? `{${JSON.stringify(n)}}` : n) };
  }
  if (hijos.length === 1 && ts.isJsxExpression(hijo) && hijo.expression && ts.isIdentifier(hijo.expression)) {
    const literal = valorInicial(hijo.expression.text, el.getSourceFile());
    if (literal) {
      const comilla = literal.getText()[0];
      return {
        valor: literal.text,
        inicio: literal.getStart(),
        fin: literal.getEnd(),
        escribir: (n) => comilla + n.replace(/\\/g, '\\\\').replaceAll(comilla, `\\${comilla}`) + comilla,
      };
    }
  }
  throw new ErrorAplicacion('El contenido no es un texto literal ni una variable con texto inicial fijo; aún no se edita');
}

/** Literal de cadena con el que se inicializa `nombre` en el fichero: `const nombre = '…'` o `const [nombre] = useState('…')`. */
function valorInicial(nombre: string, fuente: ts.SourceFile): ts.StringLiteralLike | undefined {
  let encontrado: ts.StringLiteralLike | undefined;
  const visitar = (nodo: ts.Node) => {
    if (encontrado) return;
    if (ts.isVariableDeclaration(nodo) && nodo.initializer) {
      const declara = ts.isIdentifier(nodo.name)
        ? nodo.name.text === nombre
        : ts.isArrayBindingPattern(nodo.name) && nodo.name.elements[0]?.getText() === nombre;
      const ini = nodo.initializer;
      if (declara && ts.isIdentifier(nodo.name) && ts.isStringLiteralLike(ini)) encontrado = ini;
      if (declara && ts.isArrayBindingPattern(nodo.name) && ts.isCallExpression(ini) && ini.expression.getText() === 'useState') {
        const [arg] = ini.arguments;
        if (arg && ts.isStringLiteralLike(arg)) encontrado = arg;
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return encontrado;
}
