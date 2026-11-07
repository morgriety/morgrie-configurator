import React, {useEffect} from 'react';
import {AccentButton} from '../../../../inputs/accent-button';
import {getMacroValidator} from 'src/utils/macro-api';
import {ControlRow, Label, Detail} from '../../../grid';
import {AccentSlider} from '../../../../inputs/accent-slider';
import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete';
import {
  AutocompleteItem,
  AutocompleteLoading,
  findKeycodes,
} from '../../../../../components/inputs/autocomplete-keycode';
import {ErrorMessage} from '../../../../styled';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const ScriptLayout = styled.div`
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  height: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
`;

const TextArea = styled.textarea`
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 10px 12px;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  background: var(--mg-editor);
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  resize: none;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;

  &::placeholder {
    color: var(--mg-text-secondary);
  }

  &&:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 2px;
  }
`;

const ToastErrorMessage = styled(ErrorMessage)`
  flex: 0 0 auto;
  margin: 8px 0 0;
  padding: 0;
  width: 100%;
  max-height: 66px;
  overflow: auto;
  overscroll-behavior: contain;
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  display: block;
  &:empty {
    display: none;
  }
`;

const Message = styled.div`
  color: var(--mg-text-secondary);
  overflow-wrap: anywhere;
`;

const Link = styled.a`
  color: var(--mg-text);
  text-decoration: underline;
  text-underline-offset: 2px;
`;

const DescriptionLabel = styled(Label)`
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  max-height: clamp(
    66px,
    calc((100dvh - var(--mg-header-height) - var(--mg-workspace-height)) * 0.24),
    110px
  );
  overflow: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 0 8px 0 0;
  color: var(--mg-text-secondary);
  font: 400 14px/22px var(--mg-font);
  letter-spacing: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--mg-border) transparent;
`;

const AutoHeightRow = styled(ControlRow)`
  min-height: 0;
  padding: 0;
  border: 0;
  align-items: stretch;
`;

const ScriptFooter = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 24px;
  margin-top: 12px;

  ${Detail} {
    flex: 0 0 auto;
  }
`;

export const ScriptMode: React.FC<{
  macro: string;
  protocol: number;
  setUnsavedMacro: (macro: string) => void;
  saveMacros: (val: string) => void;
  macroIndex: number;
  isDelaySupported: boolean;
}> = ({
  macro,
  protocol,
  setUnsavedMacro,
  saveMacros,
  macroIndex,
  isDelaySupported,
}) => {
  const {t} = useTranslation();
  const trimmedMacro = macro.trimEnd();
  const [currentValue, setCurrentValue] = React.useState(trimmedMacro);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    setUnsavedMacro(currentValue);
  }, [currentValue]);

  const saveMacro = () => {
    const validate = getMacroValidator(protocol);
    const validationResult = validate(currentValue);
    if (validationResult.isValid) {
      saveMacros(currentValue);
      setErrorMessage(undefined);
    } else {
      setErrorMessage(validationResult.errorMessage);
    }
  };
  const hasError = errorMessage !== undefined;
  return (
    <ScriptLayout>
      <AutoHeightRow>
        <ReactTextareaAutocomplete
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          loadingComponent={AutocompleteLoading}
          style={{
            fontSize: '14px',
            lineHeight: '22px',
            width: '100%',
            height: '100%',
            fontFamily: 'var(--mg-font)',
            resize: 'none',
            borderColor: hasError
              ? 'var(--color_error)'
              : 'var(--mg-border)',
          }}
          containerStyle={{
            border: 'none',
            lineHeight: '22px',
            width: '100%',
            height: '100%',
          }}
          itemStyle={{
            borderColor: 'var(--mg-border)',
            backgroundColor: 'var(--mg-editor)',
          }}
          dropdownStyle={{
            zIndex: 999,
            backgroundColor: 'var(--mg-editor)',
          }}
          listStyle={{
            position: 'fixed',
            backgroundColor: 'var(--mg-editor)',
            maxHeight: 'min(210px, 35vh)',
            borderRadius: '7px',
            fontSize: '14px',
            lineHeight: '22px',
            overflow: 'auto',
            border: '1px solid var(--mg-border)',
          }}
          minChar={0}
          textAreaComponent={TextArea as any}
          movePopupAsYouType={true}
          placeholder={`Enter the macro you want M${macroIndex} to execute...`}
          trigger={{
            '?': {
              dataProvider: findKeycodes,
              component: AutocompleteItem,
              output: (item: any) => ({
                text: item.code,
                caretPosition: 'end',
              }),
            },
            '{': {
              dataProvider: findKeycodes,
              component: AutocompleteItem,
              output: (item: any) => ({
                text: `{${item.code},`,
                caretPosition: 'end',
              }),
            },
            ',': {
              dataProvider: findKeycodes,
              component: AutocompleteItem,
              output: (item: any) => {
                return {
                  text: `,${item.code},`,
                  caretPosition: 'end',
                };
              },
            },
          }}
        />
      </AutoHeightRow>
      <ToastErrorMessage role="alert">{errorMessage}</ToastErrorMessage>
      <ScriptFooter>
        <DescriptionLabel>
          <Message>
            {t('Enter text directly, or wrap')}{' '}
            <Link href="https://docs.qmk.fm/#/keycodes_basic" target="_blank">
              {t('Basic Keycodes')}
            </Link>{' '}
            {t('in {}')}
          </Message>
          <Message>
            {t('Single tap')}: {'{KC_XXX}'}
          </Message>
          <Message>
            {t('Chord')}: {'{KC_XXX, KC_YYY, KC_ZZZ}'}
          </Message>
          <Message>
            {t('Keydown')}: {`{+KC_XXX}`}
          </Message>
          <Message>
            {t('Keyup')}: {`{-KC_XXX}`}
          </Message>
          {isDelaySupported ? (
            <Message>
              {t('Delay (ms)')}: {'{NNNN}'}{' '}
            </Message>
          ) : (
            <Message>{t('Upgrade firmware to use delays')}</Message>
          )}
          <Message>{t('Type ? to search for keycodes')}</Message>
        </DescriptionLabel>
        <Detail>
          <AccentButton disabled={macro === currentValue} onClick={saveMacro}>
            {t('Save')}
          </AccentButton>
        </Detail>
      </ScriptFooter>
    </ScriptLayout>
  );
};
