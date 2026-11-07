import styled from 'styled-components';

const TextInput = styled.input`
  box-sizing: border-box;
  height: 34px;
  min-width: 0;
  background: var(--mg-editor);
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  color: var(--mg-text);
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;
  margin-bottom: 1.5rem;
  padding: 5px 10px;
  transition: border-color 140ms ease;

  &:focus {
    border-color: var(--mg-text-secondary);
    outline: none;
  }

  &::placeholder {
    color: var(--mg-text-secondary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default TextInput;
