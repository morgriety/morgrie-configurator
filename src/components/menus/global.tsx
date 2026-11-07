import styled from 'styled-components';
import morgrieLogo from '../../assets/images/morgrie-logo.png';
import {Badge} from '../panes/configure-panes/badge';
import {ExternalLinks} from './external-links';
import {LanguageSelect} from './language-select';

const Header = styled.header`
  position: fixed;
  inset: 0 0 auto;
  z-index: 30;
  box-sizing: border-box;
  width: 100%;
  height: var(--mg-header-height);
  overflow: visible;
  padding: 0 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  background: var(--mg-header);
  color: #f1eeeb;
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: 0;

  @media (max-width: 1100px) {
    padding: 0 24px;
    gap: 20px;
  }

  @media (max-width: 760px) {
    padding: 0 16px;
    gap: 12px;
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 35px;
  flex: 0 0 auto;

  @media (max-width: 1100px) {
    gap: 20px;
  }
`;

const Logo = styled.img`
  display: block;
  width: 155px;
  height: auto;
  filter: grayscale(1) invert(1) brightness(1.6);
  mix-blend-mode: screen;

  @media (max-width: 760px) {
    width: 120px;
  }
`;

const BrandLabel = styled.span`
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  letter-spacing: 3px;
  color: #e0dedc;

  @media (max-width: 1000px) {
    display: none;
  }
`;

const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  gap: 26px;
  min-width: 0;

  @media (max-width: 1100px) {
    gap: 16px;
  }

  @media (max-width: 760px) {
    gap: 10px;
  }
`;

const Divider = styled.span`
  width: 1px;
  height: 26px;
  flex: 0 0 1px;
  background: rgba(255, 255, 255, 0.2);
`;

export const UnconnectedGlobalMenu = () => (
  <Header>
    <Brand>
      <Logo src={morgrieLogo} alt="MORGRIE" />
      <BrandLabel>CONFIGURATOR</BrandLabel>
    </Brand>
    <HeaderControls>
      <Badge />
      <Divider aria-hidden="true" />
      <LanguageSelect />
      <Divider aria-hidden="true" />
      <ExternalLinks />
    </HeaderControls>
  </Header>
);
