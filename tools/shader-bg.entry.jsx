// ORION backdrop: the ShaderGradient Landon designed, mounted into a given element.
// Built into js/vendor/shader-bg.js (React 18.3.1, three 0.169, @react-three/fiber 8.17.10,
// @shadergradient/react 2.4.20). To change a setting, edit it below and rebuild in a scratch folder:
//   npm i @shadergradient/react@2.4.20 react@18.3.1 react-dom@18.3.1 three@0.169.0 @react-three/fiber@8.17.10 esbuild@0.24.0
//   echo 'export const ControlType={};export const addPropertyControls=()=>{};export default {};' > framer-stub.js
//   npx esbuild shader-bg.entry.jsx --bundle --format=esm --minify --jsx=automatic --alias:framer=./framer-stub.js \
//     --define:process.env.NODE_ENV='"production"' --legal-comments=none --outfile=shader-bg.js
// then point its HDR folder at our copy: sed 's#https://ruucm.github.io/shadergradient/ui@0.0.0/assets/hdr/#assets/hdr/#'
import { createRoot } from 'react-dom/client';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

export function mount(el, { still = false } = {}) {
  const root = createRoot(el);
  root.render(
    <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} pixelDensity={1} fov={45} lazyLoad={false}>
      <ShaderGradient
        animate={still ? 'off' : 'on'} axesHelper="off" brightness={1}
        cAzimuthAngle={180} cDistance={2.8} cPolarAngle={80} cameraZoom={9.1}
        color1="#606080" color2="#8d7dca" color3="#212121"
        envPreset="city" grain="on" lightType="3d"
        positionX={0} positionY={0} positionZ={0} range="disabled" rangeEnd={40} rangeStart={0}
        reflection={0.1} rotationX={50} rotationY={0} rotationZ={-60}
        shader="defaults" type="waterPlane"
        uAmplitude={0} uDensity={1.5} uFrequency={0} uSpeed={0.3} uStrength={1.5} uTime={8}
        wireframe={false}
      />
    </ShaderGradientCanvas>,
  );
  return () => root.unmount();
}
