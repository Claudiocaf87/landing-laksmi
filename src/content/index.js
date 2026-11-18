// Contenido en tiempo de ejecución (mensajes del formulario, etc.).
// Para sumar inglés: crear en.json con la misma estructura y usar VITE_LANG=en.
const files = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const lang = import.meta.env.VITE_LANG || 'es';
export const content = files[`./${lang}.json`] ?? files['./es.json'];
