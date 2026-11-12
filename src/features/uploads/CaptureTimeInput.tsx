export function CaptureTimeInput({
  value,
  onChange,
  disabled,
  required,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
  required?: boolean
}) {
  return (
    <label>
      เวลาถ่าย (ไทย)
      <input
        type="datetime-local"
        step="1"
        value={value}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
