# Documentación de Avance - Fase 7: Inteligencia Artificial

**Fecha:** Septiembre 2026  
**Estado:** Completado  
**Objetivo:** Implementar el módulo de análisis de correos electrónicos mediante OpenAI API, con protección contra Prompt Injection, clasificación categórica, priorización y generación de resúmenes concisos.

---

## 📁 Componentes Implementados

### 1. Definición de Prompts y Seguridad
* [`src/ai/prompts.ts`](file:///e:/SistemasWeb/bot-email/src/ai/prompts.ts):
  * Define las 9 categorías oficiales del plan: *Urgente, Requiere respuesta, Trabajo, Facturación, Informativo, Publicidad, Spam, Personal, Otro*.
  * Define la escala de prioridades del 1 (Muy baja) al 5 (Crítica).
  * **Defensa contra Prompt Injection:** Directiva explícita que instruye al modelo a considerar todo el cuerpo y asunto del correo como datos no confiables, ignorando cualquier orden o directiva maliciosa que contenga el texto.

### 2. Analizador de IA Multiprovedor (OpenRouter Free + OpenAI)
* [`src/ai/analyzer.ts`](file:///e:/SistemasWeb/bot-email/src/ai/analyzer.ts):
  * **OpenRouter prioritario con modelos Free:** Soporte nativo para `OPENROUTER_API_KEY` utilizando el modelo `openrouter/free`. OpenRouter balancea y rige dinámicamente sobre los mejores modelos gratuitos activos (Gemma, Nemotron, Dots, Llama) con costo $0.
  * **OpenAI secundario:** Si no hay clave de OpenRouter pero sí de OpenAI (`OPENAI_API_KEY`), ejecuta `gpt-4o-mini`.
  * Trunca textos extensos a 4000 caracteres para evitar desbordamiento de contexto.
  * **Extracción JSON resiliente:** Limpia delimitadores markdown (```json) y tokens de razonamiento (`reasoning_details`) devueltos por modelos tipo reasoning.
  * **Normalización de categorías:** Mapea variaciones semánticas a las 9 categorías oficiales de forma estricta.
  * **Fallback heurístico inteligente:** Si ninguna API responde o hay fallos de red, el sistema clasifica automáticamente por palabras clave y patrones heurísticos para garantizar cero interrupciones en el flujo de trabajo.

### 3. Integración OpenRouter MCP
* [`.agents/mcp_config.json`](file:///e:/SistemasWeb/bot-email/.agents/mcp_config.json):
  * Configuración del servidor remoto MCP de OpenRouter (`https://mcp.openrouter.ai/mcp`) para inspección de modelos, cotizaciones y pruebas en caliente desde el entorno de desarrollo.
* **Claude Code CLI:**
  * Servidor HTTP MCP agregado en el proyecto mediante `claude mcp add --transport http openrouter https://mcp.openrouter.ai/mcp`.

