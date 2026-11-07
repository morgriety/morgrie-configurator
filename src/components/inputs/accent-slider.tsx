import React from 'react';
import styled from 'styled-components';

export const HiddenInput = styled.input`
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
`;

const Switch = styled.label`
  position: relative;
  display: inline-block;
  flex: 0 0 42px;
  width: 42px;
  height: 22px;

  &:focus-within > span {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 3px;
  }
`;
const Slider = styled.span<{$ischecked?: boolean}>`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${(props) =>
    props.$ischecked ? 'var(--mg-text)' : 'var(--mg-keyboard-frame)'};
  transition: background-color 140ms ease;
  border-radius: 11px;
  &:before {
    position: absolute;
    content: '';
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    border-radius: 50%;
    background-color: var(--mg-editor);
    transition: transform 140ms ease;
    ${(props) => (props.$ischecked ? 'transform: translateX(20px)' : '')};
  }
`;

type Props = {
  id?: string;
  keepFocus?: boolean;
  isChecked: boolean;
  onChange: (val: boolean) => void;
};

export function AccentSlider(props: Props) {
  const {isChecked, onChange} = props;

  const [isHiddenChecked, setIsHiddenChecked] = React.useState(isChecked);

  // If the parent isChecked changes, update our local checked state
  React.useEffect(() => {
    setIsHiddenChecked(isChecked);
  }, [isChecked]);

  const hiddenOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newIsChecked = !isChecked;
    setIsHiddenChecked(newIsChecked);
    onChange(newIsChecked);
    if (!props.keepFocus) event.currentTarget.blur();
  };

  return (
    <Switch>
      <HiddenInput
        id={props.id}
        type="checkbox"
        checked={isHiddenChecked}
        onChange={hiddenOnChange}
      />
      <Slider $ischecked={isHiddenChecked} />
    </Switch>
  );
}
