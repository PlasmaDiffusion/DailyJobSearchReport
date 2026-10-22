export const DEFAULT_PICKER_COLOR = '#f6d000';

type ColorPickerProps = {
  color?: string;
  onChange: (color: string) => void;
};

export function ColorPicker({ color = DEFAULT_PICKER_COLOR, onChange }: ColorPickerProps) {
  return (
    <label className="color-picker-control">
      Colour picker
      <input
        aria-label="Workspace colour"
        type="color"
        value={color}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
