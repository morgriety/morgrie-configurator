import styled from 'styled-components';

type AccentButtonProps = {
  disabled?: boolean;
  onClick?: (...a: any[]) => void;
};

const AccentButtonBase = styled.button<AccentButtonProps>`
  height: 34px;
  padding: 0 15px;
  line-height: 22px;
  min-width: 100px;
  text-align: center;
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0;
  border-radius: 7px;
  color: var(--mg-text);
  border: 1px solid var(--mg-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  transition: background-color 140ms ease, border-color 140ms ease;

  &:hover {
    border-color: var(--mg-text-secondary);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 3px;
  }
`;
export const AccentButton = styled(AccentButtonBase)`
  background-color: var(--mg-editor);
  color: var(--mg-text);
  border-color: var(--mg-border);

  &:hover {
    background-color: var(--mg-nav-active);
  }
`;
export const AccentButtonLarge = styled(AccentButton)`
  font-size: 14px;
  line-height: 22px;
  height: 40px;
  padding: 0 20px;
`;

export const PrimaryAccentButton = styled(AccentButtonBase)`
  color: var(--mg-editor);
  border-color: var(--mg-text);
  background-color: var(--mg-text);
  &:hover {
    background-color: var(--mg-text-secondary);
    border-color: var(--mg-text-secondary);
  }
`;
