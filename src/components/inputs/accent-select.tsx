import React from 'react';
import Select, {Props} from 'react-select';

const customStyles = {
  option: (provided: any, state: any) => ({
    ...provided,
    padding: '7px 10px',
    background: state.isSelected
      ? 'var(--mg-text)'
      : state.isFocused
      ? 'var(--mg-nav-active)'
      : 'var(--mg-editor)',
    color: state.isSelected ? 'var(--mg-editor)' : 'var(--mg-text)',
    fontWeight: state.isSelected ? 500 : 400,
    opacity: state.isDisabled ? 0.5 : 1,
    ':active': {
      backgroundColor: state.isSelected
        ? 'var(--mg-text)'
        : 'var(--mg-nav-active)',
    },
  }),
  container: (provided: any) => ({
    ...provided,
    fontFamily: 'Inter, Arial, sans-serif',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '22px',
    letterSpacing: 0,
    minWidth: 0,
    flex: 1,
  }),
  input: (provided: any) => ({
    ...provided,
    margin: 0,
    padding: 0,
    color: 'var(--mg-text)',
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: 'var(--mg-text)',
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    padding: 6,
    color: 'var(--mg-text-secondary)',
    '&:hover': {
      color: 'var(--mg-text)',
    },
  }),
  clearIndicator: (provided: any) => ({
    ...provided,
    padding: 6,
    color: 'var(--mg-text-secondary)',
  }),
  indicatorSeparator: (provided: any) => ({
    ...provided,
    backgroundColor: 'var(--mg-border)',
  }),
  menu: (provided: any) => ({
    ...provided,
    marginTop: 5,
    border: '1px solid var(--mg-border)',
    borderRadius: 7,
    boxShadow: 'none',
    overflow: 'hidden',
    backgroundColor: 'var(--mg-editor)',
    zIndex: 10,
  }),
  menuList: (provided: any) => ({
    ...provided,
    padding: 4,
    backgroundColor: 'var(--mg-editor)',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: 'var(--mg-text-secondary)',
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    padding: '2px 10px',
    color: 'var(--mg-text)',
  }),
  multiValue: (provided: any) => ({
    ...provided,
    borderRadius: 4,
    backgroundColor: 'var(--mg-nav-active)',
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    color: 'var(--mg-text)',
  }),
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 34,
    height: state.isMulti ? 'auto' : 34,
    boxShadow: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: state.isFocused
      ? 'var(--mg-text-secondary)'
      : 'var(--mg-border)',
    borderRadius: 7,
    background: 'var(--mg-editor)',
    color: 'var(--mg-text)',
    opacity: state.isDisabled ? 0.5 : 1,
    transition: 'border-color 140ms ease',
    '&:hover': {
      borderColor: 'var(--mg-text-secondary)',
    },
    width: state.selectProps.width || 250,
    maxWidth: '100%',
  }),
};

export const AccentSelect: React.FC<Props> = (props) => (
  <Select {...props} styles={customStyles} />
);