/**
 * integrationKeys.ts — единая точка импорта ключей интеграций.
 * Ре-экспортирует getImgbbKey/setImgbbKey, getNpApiKey/setNpApiKey,
 * getNpConfig/setNpConfig из оригинальных модулей.
 * Оригинальные файлы НЕ изменяются; обратная совместимость сохранена.
 */
export { getImgbbKey, setImgbbKey } from './imgbbKey'
export { getNpApiKey, setNpApiKey } from './npApiKey'
export { getNpConfig, setNpConfig } from './npConfig'
export type { NpSenderConfig } from './npConfig'
