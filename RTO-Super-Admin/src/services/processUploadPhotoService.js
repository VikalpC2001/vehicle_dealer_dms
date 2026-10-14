import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * CRUD for a vehicle process's uploaded photos (`process_upload_photo`) — both `DOCUMENT`
 * scans and free-form `VEHICLE` photos. Each write relocates the freshly-uploaded flat
 * `imageName` upload key into the per-process folder server-side.
 *
 * An **agent** managing a dealer passes `dealerId` (sent in the body for writes AND as a
 * query param, mirroring `vehicleProcessService.setTags`); a dealer omits it (token-scoped).
 */
export const processUploadPhotoService = {
  /**
   * POST /process-upload-photos — attach an uploaded image to a process. `imageName` is the
   * flat upload fileKey; the server moves it into the process folder. `kind` defaults to
   * `DOCUMENT`; `VEHICLE` is capped at 5 per process (409 on exceed).
   *
   * @param {{ processId: string, category: string, imageName: string, kind?: 'DOCUMENT'|'VEHICLE', dealerId?: string }} params
   */
  async create({ processId, category, imageName, kind, dealerId }) {
    const body = { processId, category, imageName }
    if (kind) body.kind = kind
    if (dealerId) body.dealerId = dealerId
    const { data } = await api.post('/process-upload-photos', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /**
   * PATCH /process-upload-photos/:id — replace the image and/or update the category. Passing a new
   * flat `imageName` relocates it and deletes the old file; passing the stored key is a category-only
   * update. `kind` is immutable.
   *
   * @param {string} id - processUploadPhotoId
   * @param {{ category: string, imageName: string }} params
   * @param {string} [dealerId]
   */
  async update(id, { category, imageName }, dealerId) {
    const body = { category, imageName }
    if (dealerId) body.dealerId = dealerId
    const { data } = await api.patch(`/process-upload-photos/${id}`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /**
   * DELETE /process-upload-photos/:id — remove the row and best-effort delete the underlying file.
   *
   * @param {string} id - processUploadPhotoId
   * @param {string} [dealerId]
   */
  async remove(id, dealerId) {
    const { data } = await api.delete(`/process-upload-photos/${id}`, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /**
   * PATCH /process-upload-photos/:id/star — mark this `VEHICLE` photo as the process's single
   * starred (profile) photo, un-starring any previous one. Agents pass their managed `dealerId`
   * as a query param (mirroring `remove`); a dealer omits it (token-scoped).
   *
   * @param {string} id - processUploadPhotoId
   * @param {string} [dealerId]
   */
  async setStarred(id, dealerId) {
    // Send an empty-object body ({}), NOT null — a `null` body serializes to the string "null" which
    // the backend's strict JSON body parser rejects ("null" is not valid JSON).
    const { data } = await api.patch(`/process-upload-photos/${id}/star`, {}, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },
}
