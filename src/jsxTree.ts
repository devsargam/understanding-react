import { parse } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import { createRequire } from "node:module";
import * as t from "@babel/types";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default as typeof import("@babel/traverse").default;

type JsxRootNode = t.JSXElement | t.JSXFragment;

export type ExplorerNode =
  | ExplorerElementNode
  | ExplorerFragmentNode
  | ExplorerTextNode
  | ExplorerExpressionNode
  | ExplorerSpreadNode;

export interface RootEntry {
  context: string;
  kind: "element" | "fragment";
  name: string;
  location: string;
  tree: ExplorerNode;
}

export interface Summary {
  elementCount: number;
  fragmentCount: number;
  textCount: number;
  expressionCount: number;
  spreadCount: number;
  propCount: number;
  maxDepth: number;
  domTags: Set<string>;
  componentTags: Set<string>;
}

interface ExplorerElementNode {
  kind: "element";
  name: string;
  props: string[];
  selfClosing: boolean;
  location: string;
  children: ExplorerNode[];
}

interface ExplorerFragmentNode {
  kind: "fragment";
  location: string;
  children: ExplorerNode[];
}

interface ExplorerTextNode {
  kind: "text";
  value: string;
  location: string;
  children: ExplorerNode[];
}

interface ExplorerExpressionNode {
  kind: "expression";
  expressionType: string;
  preview: string;
  location: string;
  children: ExplorerNode[];
}

interface ExplorerSpreadNode {
  kind: "spread";
  preview: string;
  location: string;
  children: ExplorerNode[];
}

export function parseJsxRoots(code: string, maxPreviewLength: number) {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const roots: RootEntry[] = [];

  traverse(ast, {
    JSXElement(path: NodePath<t.JSXElement>) {
      if (path.findParent((parent) => parent.isJSXElement() || parent.isJSXFragment())) {
        return;
      }

      roots.push(createRootEntry(path.node, describeRootContext(path), code, maxPreviewLength));
      path.skip();
    },
    JSXFragment(path: NodePath<t.JSXFragment>) {
      if (path.findParent((parent) => parent.isJSXElement() || parent.isJSXFragment())) {
        return;
      }

      roots.push(createRootEntry(path.node, describeRootContext(path), code, maxPreviewLength));
      path.skip();
    },
  });

  return roots;
}

export function renderTree(
  node: ExplorerNode,
  showLocations: boolean,
  prefix = "",
  isLast = true,
): string[] {
  const connector = isLast ? "└─ " : "├─ ";
  const lines = [`${prefix}${connector}${formatNode(node, showLocations)}`];
  const nextPrefix = `${prefix}${isLast ? "   " : "│  "}`;

  node.children.forEach((child, index) => {
    lines.push(
      ...renderTree(child, showLocations, nextPrefix, index === node.children.length - 1),
    );
  });

  return lines;
}

export function summarizeRoots(roots: RootEntry[]): Summary {
  const summary: Summary = {
    elementCount: 0,
    fragmentCount: 0,
    textCount: 0,
    expressionCount: 0,
    spreadCount: 0,
    propCount: 0,
    maxDepth: 0,
    domTags: new Set<string>(),
    componentTags: new Set<string>(),
  };

  roots.forEach((root) => walkSummary(root.tree, summary, 1));
  return summary;
}

export function formatSet(values: Set<string>) {
  if (values.size === 0) {
    return "(none)";
  }

  return [...values].sort((left, right) => left.localeCompare(right)).join(", ");
}

export function formatRootLabel(root: RootEntry) {
  return root.kind === "fragment" ? "<Fragment>" : `<${root.name}>`;
}

function createRootEntry(
  node: JsxRootNode,
  context: string,
  code: string,
  maxPreviewLength: number,
): RootEntry {
  return {
    context,
    kind: t.isJSXElement(node) ? "element" : "fragment",
    name: t.isJSXElement(node) ? getJsxName(node.openingElement.name) : "<>",
    location: formatLocation(node),
    tree: buildTree(node, code, maxPreviewLength),
  };
}

function buildTree(
  node: t.JSXElement | t.JSXFragment | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild,
  code: string,
  maxPreviewLength: number,
): ExplorerNode {
  if (t.isJSXElement(node)) {
    return {
      kind: "element",
      name: getJsxName(node.openingElement.name),
      props: node.openingElement.attributes.map((attribute) =>
        formatAttribute(attribute, code, maxPreviewLength),
      ),
      selfClosing: node.openingElement.selfClosing,
      location: formatLocation(node),
      children: node.children
        .map((child) => buildChildNode(child, code, maxPreviewLength))
        .filter((child): child is ExplorerNode => child !== null),
    };
  }

  if (t.isJSXFragment(node)) {
    return {
      kind: "fragment",
      location: formatLocation(node),
      children: node.children
        .map((child) => buildChildNode(child, code, maxPreviewLength))
        .filter((child): child is ExplorerNode => child !== null),
    };
  }

  if (t.isJSXText(node)) {
    return {
      kind: "text",
      value: normalizeText(node.value),
      location: formatLocation(node),
      children: [],
    };
  }

  if (t.isJSXSpreadChild(node)) {
    return {
      kind: "spread",
      preview: getSnippet(node.expression, code, maxPreviewLength),
      location: formatLocation(node),
      children: [],
    };
  }

  const expression = node.expression;
  const nestedRoots = t.isJSXEmptyExpression(expression)
    ? []
    : collectNestedJsxRoots(expression).map((child) =>
        buildTree(child, code, maxPreviewLength),
      );

  return {
    kind: "expression",
    expressionType: expression.type,
    preview: t.isJSXEmptyExpression(expression)
      ? "<empty>"
      : getSnippet(expression, code, maxPreviewLength),
    location: formatLocation(node),
    children: nestedRoots,
  };
}

function buildChildNode(
  child: t.JSXElement | t.JSXFragment | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild,
  code: string,
  maxPreviewLength: number,
) {
  if (t.isJSXText(child) && normalizeText(child.value) === "") {
    return null;
  }

  if (t.isJSXExpressionContainer(child) && t.isJSXEmptyExpression(child.expression)) {
    return null;
  }

  return buildTree(child, code, maxPreviewLength);
}

function collectNestedJsxRoots(value: unknown, roots: JsxRootNode[] = []): JsxRootNode[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedJsxRoots(item, roots));
    return roots;
  }

  if (!isNode(value)) {
    return roots;
  }

  if (t.isJSXElement(value) || t.isJSXFragment(value)) {
    roots.push(value);
    return roots;
  }

  const visitorKeys = t.VISITOR_KEYS[value.type];
  if (!visitorKeys) {
    return roots;
  }

  for (const key of visitorKeys) {
    const fields = value as unknown as Record<string, unknown>;
    collectNestedJsxRoots(fields[key], roots);
  }

  return roots;
}

function describeRootContext(path: NodePath<JsxRootNode>) {
  const functionName = findFunctionName(path);

  if (path.parentPath?.isReturnStatement()) {
    return functionName ? `return in ${functionName}()` : "return statement";
  }

  if (path.parentPath?.isArrowFunctionExpression()) {
    return functionName ? `implicit return in ${functionName}()` : "implicit return";
  }

  if (path.parentPath?.isVariableDeclarator() && t.isIdentifier(path.parentPath.node.id)) {
    return `assigned to ${path.parentPath.node.id.name}`;
  }

  if (path.parentPath?.isExportDefaultDeclaration()) {
    return "default export";
  }

  if (path.parentPath?.isCallExpression()) {
    return `argument to ${getCalleeName(path.parentPath.node.callee)}`;
  }

  return functionName ? `inside ${functionName}()` : path.parentPath?.type ?? "program";
}

function findFunctionName(path: NodePath<t.Node>) {
  const functionPath = path.findParent(
    (parent) =>
      parent.isFunctionDeclaration() ||
      parent.isFunctionExpression() ||
      parent.isArrowFunctionExpression() ||
      parent.isClassMethod(),
  );

  if (!functionPath) {
    return null;
  }

  if (functionPath.isFunctionDeclaration() || functionPath.isFunctionExpression()) {
    return functionPath.node.id?.name ?? inferNameFromParent(functionPath);
  }

  if (functionPath.isArrowFunctionExpression()) {
    return inferNameFromParent(functionPath);
  }

  if (functionPath.isClassMethod() && t.isIdentifier(functionPath.node.key)) {
    return functionPath.node.key.name;
  }

  return null;
}

function inferNameFromParent(
  path: NodePath<
    t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
  >,
) {
  if (path.parentPath?.isVariableDeclarator() && t.isIdentifier(path.parentPath.node.id)) {
    return path.parentPath.node.id.name;
  }

  if (path.parentPath?.isAssignmentExpression() && t.isIdentifier(path.parentPath.node.left)) {
    return path.parentPath.node.left.name;
  }

  if (path.parentPath?.isObjectProperty() && t.isIdentifier(path.parentPath.node.key)) {
    return path.parentPath.node.key.name;
  }

  return null;
}

function getCalleeName(callee: t.Expression | t.V8IntrinsicIdentifier) {
  if (t.isIdentifier(callee)) {
    return callee.name;
  }

  if (t.isMemberExpression(callee)) {
    return `${getMemberObjectName(callee.object)}.${getMemberPropertyName(callee.property)}`;
  }

  return callee.type;
}

function getMemberObjectName(object: t.Expression | t.Super): string {
  if (t.isIdentifier(object)) {
    return object.name;
  }

  if (t.isMemberExpression(object)) {
    return `${getMemberObjectName(object.object)}.${getMemberPropertyName(object.property)}`;
  }

  if (t.isThisExpression(object)) {
    return "this";
  }

  if (t.isSuper(object)) {
    return "super";
  }

  return object.type;
}

function getMemberPropertyName(property: t.MemberExpression["property"]) {
  if (t.isIdentifier(property)) {
    return property.name;
  }

  if (t.isPrivateName(property)) {
    return property.id.name;
  }

  return property.type;
}

function formatNode(node: ExplorerNode, showLocations: boolean) {
  const location = showLocations ? ` ${node.location}` : "";

  switch (node.kind) {
    case "element": {
      const props = node.props.length > 0 ? ` ${node.props.join(" ")}` : "";
      const closing = node.selfClosing ? " /" : "";
      return `<${node.name}${props}${closing}>${location}`;
    }
    case "fragment":
      return `<Fragment>${location}`;
    case "text":
      return `"${node.value}"${location}`;
    case "expression":
      return `{${node.preview}} [${node.expressionType}]${location}`;
    case "spread":
      return `{...${node.preview}}${location}`;
  }
}

function formatAttribute(
  attribute: t.JSXAttribute | t.JSXSpreadAttribute,
  code: string,
  maxPreviewLength: number,
) {
  if (t.isJSXSpreadAttribute(attribute)) {
    return `{${getSnippet(attribute, code, maxPreviewLength)}}`;
  }

  const name = getAttributeName(attribute.name);
  const value = attribute.value;

  if (value == null) {
    return name;
  }

  if (t.isStringLiteral(value)) {
    return `${name}=${JSON.stringify(value.value)}`;
  }

  if (t.isJSXExpressionContainer(value)) {
    const expression = value.expression;
    if (t.isJSXEmptyExpression(expression)) {
      return `${name}={<empty>}`;
    }

    return `${name}={${getSnippet(expression, code, maxPreviewLength)}}`;
  }

  return `${name}=${getSnippet(value, code, maxPreviewLength)}`;
}

function getAttributeName(name: t.JSXAttribute["name"]) {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  }

  return `${name.namespace.name}:${name.name.name}`;
}

function getJsxName(name: t.JSXElement["openingElement"]["name"]) {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  }

  if (t.isJSXMemberExpression(name)) {
    return `${getJsxNameFromObject(name.object)}.${name.property.name}`;
  }

  return `${name.namespace.name}:${name.name.name}`;
}

function getJsxNameFromObject(
  object: t.JSXIdentifier | t.JSXMemberExpression,
): string {
  if (t.isJSXIdentifier(object)) {
    return object.name;
  }

  return `${getJsxNameFromObject(object.object)}.${object.property.name}`;
}

function getSnippet(node: t.Node, code: string, maxPreviewLength: number) {
  if (node.start === null || node.end === null) {
    return node.type;
  }

  const source = code.slice(node.start, node.end);
  const normalized = source.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxPreviewLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxPreviewLength - 1)}…`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatLocation(node: t.Node) {
  if (!node.loc) {
    return "@ ?:?";
  }

  return `@ ${node.loc.start.line}:${node.loc.start.column + 1}`;
}

function walkSummary(node: ExplorerNode, summary: Summary, depth: number) {
  summary.maxDepth = Math.max(summary.maxDepth, depth);

  switch (node.kind) {
    case "element":
      summary.elementCount += 1;
      summary.propCount += node.props.length;
      if (isComponentTag(node.name)) {
        summary.componentTags.add(node.name);
      } else {
        summary.domTags.add(node.name);
      }
      break;
    case "fragment":
      summary.fragmentCount += 1;
      break;
    case "text":
      summary.textCount += 1;
      break;
    case "expression":
      summary.expressionCount += 1;
      break;
    case "spread":
      summary.spreadCount += 1;
      break;
  }

  node.children.forEach((child) => walkSummary(child, summary, depth + 1));
}

function isComponentTag(name: string) {
  return /^[A-Z]/.test(name);
}

function isNode(value: unknown): value is t.Node {
  return value !== null && typeof value === "object" && "type" in value;
}
