// Pipedrive-metadata shapes (subset van wat /v1 returnt; alleen wat de UI nodig heeft)

export type PipedriveUser = {
  id: number
  name: string
  email: string
  active_flag: boolean
}

export type PipedrivePipeline = {
  id: number
  name: string
  active: boolean
  order_nr: number
}

export type PipedriveStage = {
  id: number
  name: string
  pipeline_id: number
  order_nr: number
}

export type PipedriveDealField = {
  key: string // 40-char hash (custom) of standaard naam
  name: string
  field_type: string // 'date' | 'enum' | 'varchar' | ...
  edit_flag: boolean
  mandatory_flag: boolean
}

// Owner-config validation result
export type OwnerConfigTestResult = {
  ok: boolean
  checks: {
    user: { ok: boolean; message?: string }
    pipeline: { ok: boolean; message?: string }
    stage: { ok: boolean; message?: string }
    deal_field: { ok: boolean; message?: string }
  }
}
