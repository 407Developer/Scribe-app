import type { DocSettings, ParaSpacingPreset, PageSizePreset, MarginsPreset } from '../lib/types'

interface Props {
  settings: DocSettings
  onChange: (patch: Partial<DocSettings>) => void
  onClose: () => void
}

const LINE_OPTIONS: [number, string][] = [
  [1, 'Single'],
  [1.15, '1.15'],
  [1.5, '1.5'],
  [2, 'Double'],
]

const PARA_OPTIONS: [ParaSpacingPreset, string][] = [
  ['none', 'None'],
  ['small', 'Compact'],
  ['normal', 'Normal'],
]

const PAGE_OPTIONS: [PageSizePreset, string][] = [
  ['letter', 'Letter (U.S.)'],
  ['a4', 'A4'],
]

const MARGIN_OPTIONS: [MarginsPreset, string][] = [
  ['normal', 'Normal — 1"'],
  ['narrow', 'Narrow — 0.5"'],
  ['wide', 'Wide — 1.25"'],
]

export function SettingsModal({ settings, onChange, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Page &amp; text</h2>

        <div className="modal-field">
          <label>Line spacing</label>
          <select value={settings.lineSpacing} onChange={(e) => onChange({ lineSpacing: Number(e.target.value) })}>
            {LINE_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label>Paragraph spacing</label>
          <select value={settings.paraSpacing} onChange={(e) => onChange({ paraSpacing: e.target.value as ParaSpacingPreset })}>
            {PARA_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label>Paper size</label>
          <select value={settings.pageSize} onChange={(e) => onChange({ pageSize: e.target.value as PageSizePreset })}>
            {PAGE_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label>Margins</label>
          <select value={settings.margins} onChange={(e) => onChange({ margins: e.target.value as MarginsPreset })}>
            {MARGIN_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <label className="modal-check">
          <input type="checkbox" checked={settings.pageNumbers} onChange={(e) => onChange({ pageNumbers: e.target.checked })} />
          Show page numbers in printed PDF and DOCX
        </label>

        <p className="modal-note">Line, paragraph, paper and margin settings carry into the printed PDF and the exported DOCX.</p>
        <div className="modal-actions">
          <button className="modal-close" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}