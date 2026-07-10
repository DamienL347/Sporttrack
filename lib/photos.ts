import { supabase } from './supabase'

export type PhotoType = 'progress' | 'goal'
export type Photo = { id?: number; date: string; type: PhotoType; path: string; created_at?: string }

const BUCKET = 'photos'

export async function loadPhotos(): Promise<Photo[]> {
  try {
    const { data, error } = await supabase.from('photos').select('*').order('date', { ascending: false })
    if (error) return []
    return (data as Photo[]) || []
  } catch {
    return []
  }
}

/** Upload d'un blob JPEG + création de la ligne. Pour 'goal', remplace l'objectif précédent. */
export async function addPhoto(blob: Blob, type: PhotoType, date: string): Promise<{ error: string | null }> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'Non connecté.' }
  const uid = auth.user.id
  const path = `${uid}/${type}-${Date.now()}.jpg`

  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (up.error) return { error: up.error.message }

  if (type === 'goal') {
    const { data: olds } = await supabase.from('photos').select('*').eq('type', 'goal')
    for (const o of (olds || []) as Photo[]) {
      if (o.path !== path) {
        await supabase.storage.from(BUCKET).remove([o.path])
        if (o.id) await supabase.from('photos').delete().eq('id', o.id)
      }
    }
  }

  const ins = await supabase.from('photos').insert({ date, type, path })
  if (ins.error) return { error: ins.error.message }
  return { error: null }
}

export async function deletePhoto(p: Photo): Promise<void> {
  await supabase.storage.from(BUCKET).remove([p.path])
  if (p.id) await supabase.from('photos').delete().eq('id', p.id)
}

/** URLs signées (bucket privé), valables 1h, indexées par path. */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  const map: Record<string, string> = {}
  for (const d of data || []) {
    if (d.signedUrl && d.path) map[d.path] = d.signedUrl
  }
  return map
}

export function daysSincePhoto(photos: Photo[], today: string): number | null {
  const prog = photos.filter((p) => p.type === 'progress')
  if (!prog.length) return null
  const t = (d: string) => new Date(d + 'T00:00:00').getTime()
  const last = prog.reduce((a, b) => (t(a.date) > t(b.date) ? a : b))
  return Math.round((t(today) - t(last.date)) / 86400000)
}

/** Redimensionne un fichier image en blob JPEG (max px sur le grand côté). */
export function fileToJpegBlob(file: File, max = 1280, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion image échouée'))), 'image/jpeg', quality)
      }
      img.onerror = () => reject(new Error('Image illisible'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Lecture du fichier échouée'))
    reader.readAsDataURL(file)
  })
}
