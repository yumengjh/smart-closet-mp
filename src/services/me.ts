// Existing ported clients, exposed from the service boundary for the “me” pages.
export { agentRequest, type Models, type Quota } from '../agent/api'
export { recommendApi } from '../recommend/api'
export { similarApi, type DuplicatePair, type DuplicateScan } from '../similar/api'
export type { Statement, StyleProfileView, RecommendationStats } from '../recommend/types'
