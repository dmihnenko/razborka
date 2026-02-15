import Select, { Props as SelectProps, StylesConfig } from 'react-select'

interface Option {
  value: string
  label: string
}

interface SearchSelectProps extends Omit<SelectProps<Option>, 'options'> {
  options: Option[]
  placeholder?: string
  isDisabled?: boolean
  isClearable?: boolean
}

const customStyles: StylesConfig<Option> = {
  control: (base, state) => ({
    ...base,
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
    '&:hover': {
      borderColor: '#3b82f6',
    },
    minHeight: '42px',
    borderRadius: '0.5rem',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#3b82f6'
      : state.isFocused
      ? '#e0e7ff'
      : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#3b82f6',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#1f2937',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.5rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    borderRadius: '0.5rem',
  }),
}

export function SearchSelect({
  options,
  placeholder = 'Выберите...',
  isDisabled = false,
  isClearable = true,
  ...props
}: SearchSelectProps) {
  return (
    <Select
      options={options}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable={isClearable}
      styles={customStyles}
      noOptionsMessage={() => 'Не найдено'}
      loadingMessage={() => 'Загрузка...'}
      {...props}
    />
  )
}

// Мультиселект
interface MultiSearchSelectProps extends Omit<SelectProps<Option, true>, 'options'> {
  options: Option[]
  placeholder?: string
  isDisabled?: boolean
}

export function MultiSearchSelect({
  options,
  placeholder = 'Выберите...',
  isDisabled = false,
  ...props
}: MultiSearchSelectProps) {
  return (
    <Select
      isMulti
      options={options}
      placeholder={placeholder}
      isDisabled={isDisabled}
      styles={customStyles}
      noOptionsMessage={() => 'Не найдено'}
      loadingMessage={() => 'Загрузка...'}
      {...props}
    />
  )
}
