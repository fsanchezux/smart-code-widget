// Sustituto de `claude -p` para los tests: lee el prompt de stdin y responde como --output-format json.
let entrada = '';
process.stdin.on('data', (d) => (entrada += d));
process.stdin.on('end', () => {
  const args = process.argv.slice(2);
  const respuesta = {
    props: { 'border-radius': '24px', inventada: 'x' },
    clases: { a4: 'mt-6 rounded-lg bg-primario hover:text-green-600', a99: 'ajeno' },
    descripcion: 'Al pasar el ratón el texto se vuelve verde.',
    explicacion: JSON.stringify({ args, recibido: entrada.includes('Petición: texto verde al pasar el ratón') }),
  };
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result: '```json\n' + JSON.stringify(respuesta) + '\n```' }));
});
