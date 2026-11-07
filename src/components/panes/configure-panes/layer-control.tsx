import {useMemo} from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {
  getNumberOfLayers,
  getSelectedLayerIndex,
  setLayer,
} from 'src/store/keymapSlice';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  overflow-x: auto;
  padding: 3px 0;
  font-weight: 500;
`;
const Label = styled.label`
  font-size: 14px;
  line-height: 20px;
  color: var(--mg-text);
  margin-right: 18px;
`;
const LayerButton = styled.button<{$selected?: boolean}>`
  width: 48px;
  height: 34px;
  flex: 0 0 48px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  border: none;
  background: ${(props) =>
    props.$selected ? 'var(--mg-header)' : 'var(--mg-layer)'};
  color: ${(props) =>
    props.$selected
      ? '#fff'
      : 'var(--mg-text)'};
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  &:focus-visible {
    /* Keep the ring inside the button and its horizontal scroll viewport. */
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: -3px;
  }
  &:hover {
    border: none;
    background: ${(props) => (props.$selected ? 'var(--mg-header)' : 'var(--mg-nav-active)')};
  }
`;

export const LayerControl = () => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const numberOfLayers = useAppSelector(getNumberOfLayers);
  const selectedLayerIndex = useAppSelector(getSelectedLayerIndex);

  const Layers = useMemo(
    () =>
      new Array(numberOfLayers)
        .fill(0)
        .map((_, idx) => idx)
        .map((layerLabel) => (
          <LayerButton
            key={layerLabel}
            $selected={layerLabel === selectedLayerIndex}
            aria-pressed={layerLabel === selectedLayerIndex}
            onClick={() => dispatch(setLayer(layerLabel))}
          >
            {layerLabel}
          </LayerButton>
        )),
    [numberOfLayers, selectedLayerIndex],
  );

  return (
    <Container>
      <Label>{t('Layer')}</Label>
      {Layers}
    </Container>
  );
};
