import {IconProp} from '@fortawesome/fontawesome-svg-core';
import {
  faCancel,
  faComputer,
  faDownload,
  faKeyboard,
  faWarning,
} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {PropsWithChildren, useState} from 'react';
import {useDispatch} from 'react-redux';
import {AppError, clearAppErrors, getAppErrors} from 'src/store/errorsSlice';
import {useAppSelector} from 'src/store/hooks';
import {DeviceInfo} from 'src/types/types';
import {formatNumberAsHex} from 'src/utils/format';
import {getDeviceDisplayName} from 'src/utils/device-display-name';
import styled from 'styled-components';
import {Link, useLocation} from 'wouter';
import {IconButtonContainer} from '../inputs/icon-button';
import {
  CategoryMenuTooltip,
  IconButtonTooltip,
  MenuTooltip,
} from '../inputs/tooltip';
import {MenuContainer} from './configure-panes/custom/menu-generator';
import {
  Grid,
  MenuCell,
  Row,
  IconContainer,
  SpanOverflowCell,
  CategoryIconContainer,
} from './grid';
import {Pane} from './pane';
import { useTranslation } from 'react-i18next';

const DiagnosticsPane = styled(Pane)`
  box-sizing: border-box;
  padding: 28px 38px;
  background: var(--mg-editor);
  color: var(--mg-text);
  font: 400 14px/22px var(--mg-font);

  @media (max-width: 1100px) {
    padding: 24px;
  }
`;

const DiagnosticsGrid = styled(Grid)`
  flex: 1;
  height: auto;
  overflow: hidden;

  ${MenuCell} {
    background: transparent;
    border-color: var(--mg-border);
  }
`;

const DiagnosticRow = styled(Row)`
  color: ${(props) =>
    props.$selected ? 'var(--mg-text)' : 'var(--mg-text-secondary)'};

  &:hover {
    color: var(--mg-text);
  }
`;

const ErrorContent = styled(SpanOverflowCell)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  padding-left: 24px;
`;

const Toolbar = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 1.3px;
`;

const ErrorList = styled.div`
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  background: var(--mg-sidebar);
`;

const EmptyState = styled.div`
  box-sizing: border-box;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
  color: var(--mg-text-secondary);

  strong {
    color: var(--mg-text);
    font-weight: 600;
  }

  p {
    margin: 0;
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  user-select: text;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--mg-border);

  &:last-of-type {
    border-bottom: 0;
  }

  > time {
    color: var(--mg-text-secondary);
    font-size: 12px;
    line-height: 20px;
  }

  > ul {
    margin: 12px 0;
    padding-left: 20px;
  }
`;

const DeviceFields = styled.dl`
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 6px 20px;
  margin: 0;

  dt {
    color: var(--mg-text-secondary);
  }

  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
`;

const DiagnosticButton = styled(IconButtonContainer)`
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--mg-border);
  border-radius: 7px;
  background: var(--mg-editor);
  color: var(--mg-text);
  transition: background-color 140ms ease, border-color 140ms ease;

  svg {
    color: currentColor;
  }

  &:hover:not(:disabled) {
    background: var(--mg-nav-active);
    border: 1px solid var(--mg-text-secondary);
    color: var(--mg-text);

    svg {
      color: currentColor;
    }
  }

  &:active:not(:disabled) {
    background: var(--mg-border);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text-secondary);
    outline-offset: 3px;
  }

  &:disabled,
  &:disabled:hover {
    color: var(--mg-text-secondary);
    background: var(--mg-editor);
    border: 1px solid var(--mg-border);
    opacity: 0.5;

    svg {
      color: currentColor;
    }
  }
`;

const printId = (id: number) => formatNumberAsHex(id, 4);

const ErrorListContainer: React.FC<
  PropsWithChildren<{
    clear: () => void;
    save: () => void;
    hasErrors: boolean;
  }>
> = (props) => {
  const {t} = useTranslation();
  const {clear, save, hasErrors} = props;
  return (
    <>
      <Toolbar>
        <Title>{t('Errors')}</Title>
        <IconButtonGroupContainer>
          <DiagnosticButton
            onClick={clear}
            disabled={!hasErrors}
            aria-label={t('Clear')}
          >
            <FontAwesomeIcon
              size={'sm'}
              color="var(--color_label)"
              icon={faCancel}
            />
            <IconButtonTooltip>{t('Clear')}</IconButtonTooltip>
          </DiagnosticButton>
          <DiagnosticButton
            onClick={save}
            disabled={!hasErrors}
            aria-label={t('Download')}
          >
            <FontAwesomeIcon
              size={'sm'}
              color="var(--color_label)"
              icon={faDownload}
            />
            <IconButtonTooltip>{t('Download')}</IconButtonTooltip>
          </DiagnosticButton>
        </IconButtonGroupContainer>
      </Toolbar>
      <ErrorList>
        {hasErrors ? (
          props.children
        ) : (
          <EmptyState>
            <strong>{t('No errors recorded')}</strong>
            <p>{t('Any detected errors will appear here.')}</p>
          </EmptyState>
        )}
      </ErrorList>
    </>
  );
};

const AppErrors: React.FC<{}> = ({}) => {
  const {t} = useTranslation();
  const errors = useAppSelector(getAppErrors);
  const dispatch = useDispatch();
  return (
    <ErrorListContainer
      clear={() => dispatch(clearAppErrors())}
      save={() => saveAppErrors(errors)}
      hasErrors={!!errors.length}
    >
      {errors.map(
        ({
          timestamp,
          deviceInfo: {productId, productName, vendorId},
          message: error,
        }) => (
          <Container key={timestamp}>
            <time>{timestamp}</time>
            <ul>
              {error?.split('\n').map((line) => (
                <li>{line}</li>
              ))}
            </ul>
            <DeviceFields>
              <dt>{t('Device')}</dt>
              <dd>{getDeviceDisplayName({productId, productName, vendorId})}</dd>
              <dt>Vid</dt>
              <dd>{printId(vendorId)}</dd>
              <dt>Pid</dt>
              <dd>{printId(productId)}</dd>
            </DeviceFields>
          </Container>
        ),
      )}
    </ErrorListContainer>
  );
};

async function saveErrors<T>(
  errors: T[],
  headers: Array<keyof (T & DeviceInfo)>,
  fileName: string,
  printRow: (error: T) => string,
) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `${fileName}.csv`,
    });
    const csvHeaders = [headers.join(', ')];
    const data = errors.map(printRow);
    const csv = csvHeaders.concat(...data).join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const writeable = await handle.createWritable();
    await writeable.write(blob);
    await writeable.close();
  } catch (err) {
    console.log('User cancelled save errors request');
  }
}

const saveAppErrors = async (errors: AppError[]) =>
  saveErrors(
    errors,
    ['timestamp', 'productName', 'vendorId', 'productId', 'message'],
    'VIA-app-errors',
    ({timestamp, deviceInfo: {productName, vendorId, productId}, message}) =>
      `${timestamp}, ${getDeviceDisplayName({productId, productName, vendorId})}, ${printId(vendorId)}, ${printId(
        productId,
      )}, "${message}"`,
  );

const IconButtonGroupContainer = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  gap: 8px;
`;

enum ErrorPaneMenu {
  KeyboardAPI,
  App,
}

const ErrorPanes: [ErrorPaneMenu, React.FC, IconProp, string][] = [
  [ErrorPaneMenu.App, AppErrors, faComputer, 'App'],
];

export const Errors = () => {
  const {t} = useTranslation();
  const [selectedPane, setSelectedPane] = useState(ErrorPaneMenu.KeyboardAPI);
  const PaneComponent = (ErrorPanes.find(([id]) => selectedPane === id) ||
    ErrorPanes[0])[1];
  return (
    <DiagnosticsPane>
      <DiagnosticsGrid>
        <MenuCell style={{pointerEvents: 'all', borderTop: 'none'}}>
          <MenuContainer>
            {ErrorPanes.map(([id, _, Icon, menuName]) => (
              <DiagnosticRow
                $selected={selectedPane === id}
                onClick={() => {
                  setSelectedPane(id);
                }}
                key={id}
              >
                <IconContainer>
                  <FontAwesomeIcon icon={Icon} />
                  <MenuTooltip>{t(menuName)}</MenuTooltip>
                </IconContainer>
              </DiagnosticRow>
            ))}
          </MenuContainer>
        </MenuCell>
        <ErrorContent>
          <PaneComponent />
        </ErrorContent>
      </DiagnosticsGrid>
    </DiagnosticsPane>
  );
};

export const ErrorLink = () => {
  const appErrors = useAppSelector(getAppErrors);
  const [location] = useLocation();
  const isSelectedRoute = location === '/errors';
  if (appErrors.length) {
    return (
      <Link to="/errors">
        <CategoryIconContainer $selected={isSelectedRoute}>
          <FontAwesomeIcon
            size={'xl'}
            icon={ErrorsPaneConfig.icon}
            color={isSelectedRoute ? 'inherit' : 'gold'}
          />
          <CategoryMenuTooltip>
            {appErrors.length} error
            {appErrors.length > 1 ? 's' : ''}
          </CategoryMenuTooltip>
        </CategoryIconContainer>
      </Link>
    );
  }

  return null;
};

export const ErrorsPaneConfig = {
  component: Errors,
  path: '/errors',
  icon: faWarning,
  key: 'errors',
  title: 'Errors',
};
