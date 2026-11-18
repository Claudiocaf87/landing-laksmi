// Configuración en un solo lugar. Se sobrescribe con variables de entorno (.env, ver .env.example).

// Endpoint del formulario. Por defecto Formspree: definí VITE_FORM_ENDPOINT en .env.
// Cualquier endpoint que acepte POST multipart/form-data y responda 2xx sirve (en fase 4: webhook de GHL).
export const FORM_ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT || 'https://formspree.io/f/TU_ID_DE_FORMSPREE';
export const isFormConfigured = () => !FORM_ENDPOINT.includes('TU_ID_DE_FORMSPREE');

// Tamaño máximo del adjunto (MB). El plan gratis de Formspree no acepta archivos: si el envío con
// archivo falla, se reintenta sin el archivo y se ofrece mandarlo por WhatsApp.
export const MAX_FILE_MB = Number(import.meta.env.VITE_FORM_MAX_MB || 10);
