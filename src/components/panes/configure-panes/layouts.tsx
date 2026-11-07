import styled from 'styled-components';
import {title, component} from '../../icons/layouts';
import {SpanOverflowCell} from '../grid';
import {
  getSelectedDefinition,
  getSelectedLayoutOptions,
  updateLayoutOption,
} from 'src/store/definitionsSlice';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {updateSelectedKey} from 'src/store/keymapSlice';
import type {LayoutLabel} from '@the-via/reader';
import type {FC} from 'react';
import {useTranslation} from 'react-i18next';

const Control = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 38px;
  color: var(--mg-text-secondary);
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;
`;

const Select = styled.select`
  max-width: 65%;
  min-height: 34px;
  padding: 4px 10px;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  color: var(--mg-text);
  background: var(--mg-editor);
  font: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--mg-text);
    outline-offset: 2px;
  }
`;

const Switch = styled.input.attrs({type: 'checkbox'})`
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  height: 22px;
  margin: 0;
  border: 1px solid var(--mg-border);
  border-radius: 22px;
  background: var(--mg-nav-active);
  cursor: pointer;
  transition: background 140ms;

  &::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--mg-editor);
    transition: transform 140ms;
  }

  &:checked {
    border-color: var(--mg-text);
    background: var(--mg-text);
  }

  &:checked::before {
    transform: translateX(20px);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text);
    outline-offset: 3px;
  }
`;

const LayoutControl: FC<{
  onChange: (val: number) => void;
  meta: {labels: LayoutLabel; selectedOption: number};
}> = ({onChange, meta: {labels, selectedOption}}) => {
  const {t} = useTranslation();
  if (Array.isArray(labels)) {
    const [label, ...optionLabels] = labels;
    return (
      <Control>
        <span>{t(label)}</span>
        <Select
          value={selectedOption}
          onChange={(event) => onChange(+event.target.value)}
        >
          {optionLabels.map((option, idx) => (
            <option key={idx} value={idx}>
              {t(option)}
            </option>
          ))}
        </Select>
      </Control>
    );
  }
  return (
    <Control>
      <span>{t(labels)}</span>
      <Switch
        checked={!!selectedOption}
        onChange={(event) => onChange(+event.target.checked)}
      />
    </Control>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
`;

const LayoutCell = styled(SpanOverflowCell)`
  height: 100%;
  max-height: max(
    0px,
    calc(100dvh - var(--mg-header-height) - var(--mg-workspace-height) - 1px)
  );
  min-height: 0;
  border: 0;
  background: var(--mg-editor);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;
`;

const LayoutHeading = styled.h2`
  margin: 0 0 16px;
  color: var(--mg-text);
  font: 600 12px/18px var(--mg-font);
  letter-spacing: 1.3px;
  text-transform: uppercase;
`;

const LayoutPane = styled.div`
  width: 100%;
  max-width: 960px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 26px 38px;
  color: var(--mg-text);
  background: var(--mg-editor);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;

  ${Container} {
    gap: 0;
  }

  ${Control} {
    box-sizing: border-box;
    min-height: 56px;
    padding: 12px 0;
    border-bottom: 1px solid var(--mg-border);
    color: var(--mg-text);
    font-family: var(--mg-font);

    &:last-child {
      border-bottom: 0;
    }

    > span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  }

  ${Select} {
    box-sizing: border-box;
    transition: border-color 140ms, background 140ms;

    &:hover:not(:disabled) {
      border-color: var(--mg-text-secondary);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  ${Switch} {
    box-sizing: border-box;
    transition: background 140ms, border-color 140ms;

    &:hover:not(:disabled) {
      border-color: var(--mg-text-secondary);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  @media (max-width: 1400px) {
    padding: 22px 28px;
  }
`;

// Both the Layouts page and Keymap details use the same device state and thunk.
export const LayoutControls: FC = () => {
  const dispatch = useAppDispatch();
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedLayoutOptions = useAppSelector(getSelectedLayoutOptions);
  const labels = selectedDefinition?.layouts.labels || [];

  if (!selectedDefinition || labels.length === 0) {
    return null;
  }

  return (
    <Container>
      {labels.map((label: LayoutLabel, idx: number) => (
        <LayoutControl
          key={idx}
          onChange={(val) => {
            // A layout option can replace the key at the selected render index.
            dispatch(updateSelectedKey(null));
            dispatch(updateLayoutOption(idx, val));
          }}
          meta={{
            labels: label,
            selectedOption: selectedLayoutOptions[idx],
          }}
        />
      ))}
    </Container>
  );
};

export const Pane: FC = () => {
  const {t} = useTranslation();
  return (
    <LayoutCell>
      <LayoutPane>
        <LayoutHeading>{t(title)}</LayoutHeading>
        <LayoutControls />
      </LayoutPane>
    </LayoutCell>
  );
};

export const Title = title;
export const Icon = component;
