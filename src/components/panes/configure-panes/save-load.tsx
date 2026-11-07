import {validateBackupKeycodesAndMacros} from 'src/utils/backup-validation';
import {getSelectedKeycodesVersion} from 'src/store/firmwareSlice';
import {store} from 'src/store';
import {createDeviceOperationContext} from 'src/store/device-operation';
import {assertBackupEncoderShape, assertBackupTarget, getBackupModelId, runBoundImport} from 'src/utils/backup-target';
import type {KeyboardAPI} from 'src/utils/keyboard-api';
import {FC, useState} from 'react';
import styled from 'styled-components';
import stringify from 'json-stringify-pretty-compact';
import {ErrorMessage, SuccessMessage} from '../../styled';
import {AccentUploadButton} from '../../inputs/accent-upload-button';
import {AccentButton} from '../../inputs/accent-button';
import {getCodeForByte} from '../../../utils/key';
import {title, component} from '../../icons/save';
import {CenterPane} from '../pane';
import {Detail, Label, ControlRow, SpanOverflowCell} from '../grid';
import {
  getBasicKeyToByte,
  getSelectedDefinition,
} from 'src/store/definitionsSlice';
import {
  getSelectedRawLayers,
  saveRawKeymapToDevice,
} from 'src/store/keymapSlice';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getSelectedConnectedDevice,
  getSelectedKeyboardAPI,
} from 'src/store/devicesSlice';
import {getExpressions, getSelectedMacros, saveMacros} from 'src/store/macrosSlice';
import {useTranslation} from 'react-i18next';
import {getSelectedDefinitionName} from 'src/store/definitionNameSlice';

type ViaSaveFile = {
  name: string;
  vendorProductId: number;
  modelDefinitionId?: string;
  layers: string[][];
  macros?: string[];
  encoders?: [string, string][][];
};

const isViaSaveFile = (obj: any): obj is ViaSaveFile =>
  obj && obj.name && obj.layers && obj.vendorProductId;

const SaveLoadCell = styled(SpanOverflowCell)`
  height: 100%;
  overflow: hidden;
  border: 0;
`;

const SaveLoadPane = styled(CenterPane)`
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--mg-editor);
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 28px 38px;

  @media (max-width: 900px) {
    padding: 20px 24px;
  }

  @media (max-height: 800px) {
    padding-top: 16px;
    padding-bottom: 16px;
  }
`;

const ActionRow = styled(ControlRow)`
  flex-shrink: 0;
  min-height: 72px;
  padding: 16px 0;
  border-color: var(--mg-border);

  ${Label} {
    min-width: 0;
    color: var(--mg-text);
    overflow-wrap: anywhere;
  }

  ${Detail} {
    flex-shrink: 0;
  }

  ${AccentButton} {
    height: 34px;
    border-radius: 7px;
  }
`;

const Feedback = styled.div`
  flex: 1;
  min-height: 0;
  max-width: 960px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;

  ${ErrorMessage}, ${SuccessMessage} {
    display: block;
    margin: 18px 0 0;
    padding-bottom: 4px;
    font: inherit;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  ${SuccessMessage} {
    color: var(--mg-text);
  }
`;

export const Pane: FC = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedDefinitionName = useAppSelector(getSelectedDefinitionName);
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const api = useAppSelector(getSelectedKeyboardAPI);
  const rawLayers = useAppSelector(getSelectedRawLayers);
  const macros = useAppSelector(getSelectedMacros);
  const expressions = useAppSelector(getExpressions);
  const keycodesVersion = useAppSelector(getSelectedKeycodesVersion);
  const {basicKeyToByte, byteToKey} = useAppSelector(getBasicKeyToByte);

  // TODO: improve typing so we can remove this
  if (!selectedDefinition || !selectedDevice || !api) {
    return null;
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getEncoderValues = async (encoderApi: KeyboardAPI) => {
    const {layouts} = selectedDefinition;
    const {keys, optionKeys} = layouts;
    const encoders = [
      ...keys,
      ...Object.values(optionKeys)
        .flatMap((a) => Object.values(a))
        .flat(),
    ]
      .filter((a) => 'ei' in a)
      .map((a) => a.ei as number);
    if (encoders.length > 0) {
      const maxEncoder = Math.max(...encoders) + 1;
      const numberOfLayers = rawLayers.length;
      const encoderValues = await Promise.all(
        Array(maxEncoder)
          .fill(0)
          .map((_, i) =>
            Promise.all(
              Array(numberOfLayers)
                .fill(0)
                .map((_, j) =>
                  Promise.all([
                    encoderApi.getEncoderValue(j, i, false),
                    encoderApi.getEncoderValue(j, i, true),
                  ]).then(
                    (a) =>
                      a.map(
                        (keyByte) =>
                          getCodeForByte(keyByte, basicKeyToByte, byteToKey) ||
                          '',
                      ) as [string, string],
                  ),
                ),
            ),
          ),
      );
      return encoderValues;
    } else {
      return [];
    }
  };

  const saveLayout = async () => {
    const operation = createDeviceOperationContext(store.getState, selectedDevice);
    if (!operation) return;
    const {vendorProductId} = selectedDefinition;
    const name = selectedDefinitionName;
    const suggestedName =
      name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '.layout.json';
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
      });
      operation.assertCurrent();
      const encoderValues = await getEncoderValues(operation.api);
      operation.assertCurrent();
      const saveFile: ViaSaveFile = {
        name,
        vendorProductId,
        modelDefinitionId: getBackupModelId(selectedDevice),
        macros: [...expressions],
        layers: rawLayers.map(
          (layer: {keymap: number[]}) =>
            layer.keymap.map(
              (keyByte: number) =>
                getCodeForByte(keyByte, basicKeyToByte, byteToKey) || '',
            ), // TODO: should empty string be empty keycode instead?
        ),
        encoders: encoderValues,
      };

      const content = stringify(saveFile);
      const blob = new Blob([content], {type: 'application/json'});
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      console.log('User cancelled save file request');
    }

    /*
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;

    link.click();
    URL.revokeObjectURL(url);
*/
  };

  const loadLayout = async ([file]: Blob[]) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    // Capture before reading the file, including an A -> B -> A generation change.
    const operation = createDeviceOperationContext(store.getState, selectedDevice);
    if (!operation) {
      setErrorMessage(t('The device is no longer ready. Select it and try again.'));
      return;
    }
    let keymap: number[][] = [];
    let encodedEncoders: [number, number][][] | undefined;
    try {
      await runBoundImport(
        operation,
        async () => JSON.parse(await file.text()) as ViaSaveFile,
        (saveFile) => {
          if (!isViaSaveFile(saveFile)) throw new Error('Could not load file: invalid data.');
          assertBackupTarget(saveFile, operation.device);
          assertBackupEncoderShape(saveFile.encoders, operation.definition, rawLayers.length);
          if (!Array.isArray(saveFile.layers) || saveFile.layers.length !== rawLayers.length ||
              saveFile.layers.some((layer, i) => !Array.isArray(layer) || layer.length !== rawLayers[i].keymap.length)) {
            throw new Error('Could not import layout: incorrect layer or key count.');
          }
          const parsed = validateBackupKeycodesAndMacros({
            layers: saveFile.layers, encoders: saveFile.encoders, macros: saveFile.macros,
            basicKeyToByte, protocol: operation.device.protocol, keycodesVersion,
            macroCount: macros.macroCount, macroBufferSize: macros.macroBufferSize,
            macrosSupported: macros.isFeatureSupported,
          });
          keymap = parsed.layers;
          encodedEncoders = parsed.encoders;
        },
        [
          async (saveFile) => {
            if (macros.isFeatureSupported && saveFile.macros) {
              await dispatch(saveMacros(operation.device, saveFile.macros, operation));
            }
          },
          async () => {
            await dispatch(saveRawKeymapToDevice(keymap, operation.device, operation));
          },
          async (saveFile) => {
            for (const [id, encoder] of (encodedEncoders ?? []).entries()) {
              for (const [layerId, layer] of encoder.entries()) {
                for (const direction of [0, 1] as const) {
                  operation.assertCurrent();
                  const key = layer[direction];
                  await operation.api.setEncoderValue(layerId, id, !!direction,
                    key);
                }
              }
            }
          },
        ],
      );
      setSuccessMessage(t('Successfully updated layout!'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? t(error.message) : t('Failed to import layout.'));
    }
  };

  return (
    <SaveLoadCell>
      <SaveLoadPane>
        <Container>
          <ActionRow>
            <Label>{t('Save Current Layout')}</Label>
            <Detail>
              <AccentButton onClick={saveLayout}>{t('Save')}</AccentButton>
            </Detail>
          </ActionRow>
          <ActionRow>
            <Label>{t('Load Saved Layout')}</Label>
            <Detail>
              <AccentUploadButton onLoad={loadLayout}>
                {t('Load')}
              </AccentUploadButton>
            </Detail>
          </ActionRow>
          <Feedback aria-live="polite">
            {errorMessage ? <ErrorMessage>{errorMessage}</ErrorMessage> : null}
            {successMessage ? (
              <SuccessMessage>{successMessage}</SuccessMessage>
            ) : null}
          </Feedback>
        </Container>
      </SaveLoadPane>
    </SaveLoadCell>
  );
};

export const Icon = component;
export const Title = title;
