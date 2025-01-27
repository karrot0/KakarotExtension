export default async function contentTemplateTool(
  write: boolean,
  a: number,
  b: number,
): Promise<number> {
  void write;
  return new Promise((resolve) => resolve(a + b));
}
