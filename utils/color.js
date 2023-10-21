
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ColorSpace from "../node_modules/colorjs.io/src/space.js";

import convertColor from "../node_modules/colorjs.io/src/to.js";
import parseColor from "../node_modules/colorjs.io/src/parse.js";
import serializeColor from "../node_modules/colorjs.io/src/serialize.js";
import {normalize, toPrecision} from "../utils/math.js";

import a98rgb from "../node_modules/colorjs.io/src/spaces/a98rgb.js";
import hsl from "../node_modules/colorjs.io/src/spaces/hsl.js";
import hsv from "../node_modules/colorjs.io/src/spaces/hsv.js";
import hwb from "../node_modules/colorjs.io/src/spaces/hwb.js";
import lch from "../node_modules/colorjs.io/src/spaces/lch.js";
import lab from "../node_modules/colorjs.io/src/spaces/lab.js";
import oklab from "../node_modules/colorjs.io/src/spaces/oklab.js";
import oklch from "../node_modules/colorjs.io/src/spaces/oklch.js";
import p3 from "../node_modules/colorjs.io/src/spaces/p3.js";
import prophoto from "../node_modules/colorjs.io/src/spaces/prophoto.js";
import rec2020 from "../node_modules/colorjs.io/src/spaces/rec2020.js";
import srgb from "../node_modules/colorjs.io/src/spaces/srgb.js";
import srgbLinear from "../node_modules/colorjs.io/src/spaces/srgb-linear.js";
import xyzd50 from "../node_modules/colorjs.io/src/spaces/xyz-d50.js";
import xyzd65 from "../node_modules/colorjs.io/src/spaces/xyz-d65.js";
import xyzabsd65 from "../node_modules/colorjs.io/src/spaces/xyz-abs-d65.js";

ColorSpace.register(a98rgb);
ColorSpace.register(hsl);
ColorSpace.register(hsv);
ColorSpace.register(hwb);
ColorSpace.register(lch);
ColorSpace.register(lab);
ColorSpace.register(oklab);
ColorSpace.register(oklch);
ColorSpace.register(p3);
ColorSpace.register(prophoto);
ColorSpace.register(rec2020);
ColorSpace.register(srgb);
ColorSpace.register(srgbLinear);
ColorSpace.register(xyzd50);
ColorSpace.register(xyzd65);
ColorSpace.register(xyzabsd65);

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Register okHSV and okHSL color spaces
// @src: https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

{
  function rgb_to_hsl(r, g, b)
  {
      r /= 255;
      g /= 255;
      b /= 255;

      let max = Math.max(r, g, b);
      let min = Math.min(r, g, b);
      let h, s;
      let l = (max + min) / 2;

      if (max == min)
      {
          h = s = 0;
      }
      else
      {
          let d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch(max)
          {
              case r:
                  h = (g - b) / d + (g < b ? 6 : 0);
                  break;
              case g:
                  h = (b - r) / d + 2;
                  break;
              case b:
                  h = (r - g) / d + 4;
                  break;
          }
          h /= 6;
      }

      return [h, s, l];
  }

  function hsl_to_rgb(h, s, l)
  {
      let r, g, b;

      if (s == 0)
      {
          r = g = b = l;
      }
      else
      {
          function hue_to_rgb(p, q, t)
          {
              if (t < 0)
                  t += 1;
              if (t > 1)
                  t -= 1;
              if (t < 1/6)
                  return p + (q - p) * 6 * t;
              if (t < 1/2)
                  return q;
              if (t < 2/3)
                  return p + (q - p) * (2/3 - t) * 6;
              return p;
          }

          let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          let p = 2 * l - q;
          r = hue_to_rgb(p, q, h + 1/3);
          g = hue_to_rgb(p, q, h);
          b = hue_to_rgb(p, q, h - 1/3);
      }

      return [r * 255, g * 255, b * 255];
  }

  function rgb_to_hsv(r, g, b)
  {
      r = r/255,
      g = g/255,
      b = b/255;

      let max = Math.max(r, g, b);
      let min = Math.min(r, g, b);
      let h, s;
      let v = max;

      let d = max - min;
      s = max == 0 ? 0 : d / max;

      if (max == min)
      {
          h = 0; // achromatic
      }
      else
      {
          switch(max){
              case r:
                  h = (g - b) / d + (g < b ? 6 : 0);
                  break;
              case g:
                  h = (b - r) / d + 2;
                  break;
              case b:
                  h = (r - g) / d + 4;
                  break;
          }
          h /= 6;
      }

      return [h, s, v];
  }

  function hsv_to_rgb(h, s, v){
      let r, g, b;

      let i = Math.floor(h * 6);
      let f = h * 6 - i;
      let p = v * (1 - s);
      let q = v * (1 - f * s);
      let t = v * (1 - (1 - f) * s);

      switch(i % 6){
          case 0:
              r = v;
              g = t;
              b = p;
              break;
          case 1:
              r = q;
              g = v;
              b = p;
              break;
          case 2:
              r = p;
              g = v;
              b = t;
              break;
          case 3:
              r = p;
              g = q;
              b = v;
              break;
          case 4:
              r = t;
              g = p;
              b = v;
              break;
          case 5:
              r = v;
              g = p;
              b = q;
              break;
      }

      return [r * 255, g * 255, b * 255];
  }

  function srgb_transfer_function(a) {
      return .0031308 >= a ? 12.92 * a : 1.055 * Math.pow(a, .4166666666666667) - .055
  }

  function srgb_transfer_function_inv(a) {
      return .04045 < a ? Math.pow((a + .055) / 1.055, 2.4) : a / 12.92
  }

  function linear_srgb_to_oklab(r,g,b)
  {
      let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

      let l_ = Math.cbrt(l);
      let m_ = Math.cbrt(m);
      let s_ = Math.cbrt(s);

      return [
          0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
          1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
          0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_,
      ];
  }

  function oklab_to_linear_srgb(L,a,b)
  {

      let l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      let m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      let s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      let l = l_*l_*l_;
      let m = m_*m_*m_;
      let s = s_*s_*s_;

      return [
      (+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      (-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      (-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
      ];
  }

  function toe(x)
  {
      const k_1 = 0.206
      const k_2 = 0.03
      const k_3 = (1+k_1)/(1+k_2)

      return 0.5*(k_3*x - k_1 + Math.sqrt((k_3*x - k_1)*(k_3*x - k_1) + 4*k_2*k_3*x))
  }

  function toe_inv(x)
  {
      const k_1 = 0.206
      const k_2 = 0.03
      const k_3 = (1+k_1)/(1+k_2)
      return (x*x + k_1*x)/(k_3*(x+k_2))
  }

  // Finds the maximum saturation possible for a given hue that fits in sRGB
  // Saturation here is defined as S = C/L
  // a and b must be normalized so a^2 + b^2 == 1
  function compute_max_saturation(a, b)
  {
      // Max saturation will be when one of r, g or b goes below zero.

      // Select different coefficients depending on which component goes below zero first
      let k0, k1, k2, k3, k4, wl, wm, ws;

      if (-1.88170328 * a - 0.80936493 * b > 1)
      {
          // Red component
          k0 = +1.19086277; k1 = +1.76576728; k2 = +0.59662641; k3 = +0.75515197; k4 = +0.56771245;
          wl = +4.0767416621; wm = -3.3077115913; ws = +0.2309699292;
      }
      else if (1.81444104 * a - 1.19445276 * b > 1)
      {
          // Green component
          k0 = +0.73956515; k1 = -0.45954404; k2 = +0.08285427; k3 = +0.12541070; k4 = +0.14503204;
          wl = -1.2684380046; wm = +2.6097574011; ws = -0.3413193965;
      }
      else
      {
          // Blue component
          k0 = +1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = +0.00692167;
          wl = -0.0041960863; wm = -0.7034186147; ws = +1.7076147010;
      }

      // Approximate max saturation using a polynomial:
      let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

      // Do one step Halley's method to get closer
      // this gives an error less than 10e6, except for some blue hues where the dS/dh is close to infinite
      // this should be sufficient for most applications, otherwise do two/three steps

      let k_l = +0.3963377774 * a + 0.2158037573 * b;
      let k_m = -0.1055613458 * a - 0.0638541728 * b;
      let k_s = -0.0894841775 * a - 1.2914855480 * b;

      {
          let l_ = 1 + S * k_l;
          let m_ = 1 + S * k_m;
          let s_ = 1 + S * k_s;

          let l = l_ * l_ * l_;
          let m = m_ * m_ * m_;
          let s = s_ * s_ * s_;

          let l_dS = 3 * k_l * l_ * l_;
          let m_dS = 3 * k_m * m_ * m_;
          let s_dS = 3 * k_s * s_ * s_;

          let l_dS2 = 6 * k_l * k_l * l_;
          let m_dS2 = 6 * k_m * k_m * m_;
          let s_dS2 = 6 * k_s * k_s * s_;

          let f  = wl * l     + wm * m     + ws * s;
          let f1 = wl * l_dS  + wm * m_dS  + ws * s_dS;
          let f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

          S = S - f * f1 / (f1*f1 - 0.5 * f * f2);
      }

      return S;
  }

  function find_cusp(a, b)
  {
    // First, find the maximum saturation (saturation S = C/L)
    let S_cusp = compute_max_saturation(a, b);

    // Convert to linear sRGB to find the first point where at least one of r,g or b >= 1:
    let rgb_at_max = oklab_to_linear_srgb(1, S_cusp * a, S_cusp * b);
    let L_cusp = Math.cbrt(1 / Math.max(Math.max(rgb_at_max[0], rgb_at_max[1]), rgb_at_max[2]));
    let C_cusp = L_cusp * S_cusp;

    return [ L_cusp , C_cusp ];
  }

  // Finds intersection of the line defined by
  // L = L0 * (1 - t) + t * L1;
  // C = t * C1;
  // a and b must be normalized so a^2 + b^2 == 1
  function find_gamut_intersection(a, b, L1, C1, L0, cusp=null)
  {
      if (!cusp)
      {
          // Find the cusp of the gamut triangle
          cusp = find_cusp(a, b);
      }

    // Find the intersection for upper and lower half seprately
    let t;
    if (((L1 - L0) * cusp[1] - (cusp[0] - L0) * C1) <= 0)
    {
      // Lower half

      t = cusp[1] * L0 / (C1 * cusp[0] + cusp[1] * (L0 - L1));
    }
    else
    {
      // Upper half

      // First intersect with triangle
      t = cusp[1] * (L0 - 1) / (C1 * (cusp[0] - 1) + cusp[1] * (L0 - L1));

      // Then one step Halley's method
      {
        let dL = L1 - L0;
        let dC = C1;

        let k_l = +0.3963377774 * a + 0.2158037573 * b;
        let k_m = -0.1055613458 * a - 0.0638541728 * b;
        let k_s = -0.0894841775 * a - 1.2914855480 * b;

        let l_dt = dL + dC * k_l;
        let m_dt = dL + dC * k_m;
        let s_dt = dL + dC * k_s;


        // If higher accuracy is required, 2 or 3 iterations of the following block can be used:
        {
          let L = L0 * (1 - t) + t * L1;
          let C = t * C1;

          let l_ = L + C * k_l;
          let m_ = L + C * k_m;
          let s_ = L + C * k_s;

          let l = l_ * l_ * l_;
          let m = m_ * m_ * m_;
          let s = s_ * s_ * s_;

          let ldt = 3 * l_dt * l_ * l_;
          let mdt = 3 * m_dt * m_ * m_;
          let sdt = 3 * s_dt * s_ * s_;

          let ldt2 = 6 * l_dt * l_dt * l_;
          let mdt2 = 6 * m_dt * m_dt * m_;
          let sdt2 = 6 * s_dt * s_dt * s_;

          let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1;
          let r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
          let r2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;

          let u_r = r1 / (r1 * r1 - 0.5 * r * r2);
          let t_r = -r * u_r;

          let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1;
          let g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
          let g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;

          let u_g = g1 / (g1 * g1 - 0.5 * g * g2);
          let t_g = -g * u_g;

          let b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s - 1;
          let b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.7076147010 * sdt;
          let b2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.7076147010  * sdt2;

          let u_b = b1 / (b1 * b1 - 0.5 * b * b2);
          let t_b = -b * u_b;

          t_r = u_r >= 0 ? t_r : 10e5;
          t_g = u_g >= 0 ? t_g : 10e5;
          t_b = u_b >= 0 ? t_b : 10e5;

          t += Math.min(t_r, Math.min(t_g, t_b));
        }
      }
    }

    return t;
  }

  function get_ST_max(a_,b_, cusp=null)
  {
      if (!cusp)
      {
          cusp = find_cusp(a_, b_);
      }

      let L = cusp[0];
      let C = cusp[1];
      return [C/L, C/(1-L)];
  }

  function get_ST_mid(a_,b_)
  {
      S = 0.11516993 + 1/(
          + 7.44778970 + 4.15901240*b_
          + a_*(- 2.19557347 + 1.75198401*b_
          + a_*(- 2.13704948 -10.02301043*b_
          + a_*(- 4.24894561 + 5.38770819*b_ + 4.69891013*a_
          )))
      );

      T = 0.11239642 + 1/(
          + 1.61320320 - 0.68124379*b_
          + a_*(+ 0.40370612 + 0.90148123*b_
          + a_*(- 0.27087943 + 0.61223990*b_
          + a_*(+ 0.00299215 - 0.45399568*b_ - 0.14661872*a_
          )))
      );

      return [S, T];
  }

  function get_Cs(L, a_, b_)
  {
      let cusp = find_cusp(a_, b_);

      let C_max = find_gamut_intersection(a_,b_,L,1,L,cusp);
      let ST_max = get_ST_max(a_, b_, cusp);

      let S_mid = 0.11516993 + 1/(
          + 7.44778970 + 4.15901240*b_
          + a_*(- 2.19557347 + 1.75198401*b_
          + a_*(- 2.13704948 -10.02301043*b_
          + a_*(- 4.24894561 + 5.38770819*b_ + 4.69891013*a_
          )))
      );

      let T_mid = 0.11239642 + 1/(
          + 1.61320320 - 0.68124379*b_
          + a_*(+ 0.40370612 + 0.90148123*b_
          + a_*(- 0.27087943 + 0.61223990*b_
          + a_*(+ 0.00299215 - 0.45399568*b_ - 0.14661872*a_
          )))
      );

      let k = C_max/Math.min((L*ST_max[0]), (1-L)*ST_max[1]);

      let C_mid;
      {
          let C_a = L*S_mid;
          let C_b = (1-L)*T_mid;

          C_mid = 0.9*k*Math.sqrt(Math.sqrt(1/(1/(C_a*C_a*C_a*C_a) + 1/(C_b*C_b*C_b*C_b))));
      }

      let C_0;
      {
          let C_a = L*0.4;
          let C_b = (1-L)*0.8;

          C_0 = Math.sqrt(1/(1/(C_a*C_a) + 1/(C_b*C_b)));
      }

      return [C_0, C_mid, C_max];
  }

  function okhsl_to_srgb(h,s,l)
  {
      if (l == 1)
      {
          return [255,255,255];
      }

      else if (l == 0)
      {
          return [0,0,0];
      }

      let a_ = Math.cos(2*Math.PI*h);
      let b_ = Math.sin(2*Math.PI*h);
      let L = toe_inv(l);

      let Cs = get_Cs(L, a_, b_);
      let C_0 = Cs[0];
      let C_mid = Cs[1];
      let C_max = Cs[2];

      let C, t, k_0, k_1, k_2;
      if (s < 0.8)
      {
          t = 1.25*s;
          k_0 = 0;
          k_1 = 0.8*C_0;
          k_2 = (1-k_1/C_mid);
      }
      else
      {
          t = 5*(s-0.8);
          k_0 = C_mid;
          k_1 = 0.2*C_mid*C_mid*1.25*1.25/C_0;
          k_2 = (1 - (k_1)/(C_max - C_mid));
      }

      C = k_0 + t*k_1/(1-k_2*t);

      // If we would only use one of the Cs:
      //C = s*C_0;
      //C = s*1.25*C_mid;
      //C = s*C_max;

      let rgb = oklab_to_linear_srgb(L, C*a_, C*b_);
      return [
          255*srgb_transfer_function(rgb[0]),
          255*srgb_transfer_function(rgb[1]),
          255*srgb_transfer_function(rgb[2]),
      ]
  }

  function srgb_to_okhsl(r,g,b)
  {
      let lab = linear_srgb_to_oklab(
          srgb_transfer_function_inv(r/255),
          srgb_transfer_function_inv(g/255),
          srgb_transfer_function_inv(b/255)
      );

      let C = Math.sqrt(lab[1]*lab[1] +lab[2]*lab[2]);
      let a_ = lab[1]/C;
      let b_ = lab[2]/C;

      let L = lab[0];
      let h = 0.5 + 0.5*Math.atan2(-lab[2], -lab[1])/Math.PI;

      let Cs = get_Cs(L, a_, b_)
      let C_0 = Cs[0];
      let C_mid = Cs[1];
      let C_max = Cs[2];

      let s;
      if (C < C_mid)
      {
          let k_0 = 0;
          let k_1 = 0.8*C_0;
          let k_2 = (1-k_1/C_mid);

          let t = (C - k_0)/(k_1 + k_2*(C - k_0));
          s = t*0.8;
      }
      else
      {
          let k_0 = C_mid;
          let k_1 = 0.2*C_mid*C_mid*1.25*1.25/C_0;
          let k_2 = (1 - (k_1)/(C_max - C_mid));

          let t = (C - k_0)/(k_1 + k_2*(C - k_0));
          s = 0.8 + 0.2*t;
      }

      let l = toe(L);
      return [h,s,l];
  }


  function okhsv_to_srgb(h,s,v)
  {
      let a_ = Math.cos(2*Math.PI*h);
      let b_ = Math.sin(2*Math.PI*h);

      let ST_max = get_ST_max(a_,b_);
      let S_max = ST_max[0];
      let S_0 = 0.5;
      let T  = ST_max[1];
      let k = 1 - S_0/S_max;

      let L_v = 1 - s*S_0/(S_0+T - T*k*s)
      let C_v = s*T*S_0/(S_0+T-T*k*s)

      let L = v*L_v;
      let C = v*C_v;

      // to present steps along the way
      //L = v;
      //C = v*s*S_max;
      //L = v*(1 - s*S_max/(S_max+T));
      //C = v*s*S_max*T/(S_max+T);

      let L_vt = toe_inv(L_v);
      let C_vt = C_v * L_vt/L_v;

      let L_new =  toe_inv(L); // * L_v/L_vt;
      C = C * L_new/L;
      L = L_new;

      let rgb_scale = oklab_to_linear_srgb(L_vt,a_*C_vt,b_*C_vt);
      let scale_L = Math.cbrt(1/(Math.max(rgb_scale[0],rgb_scale[1],rgb_scale[2],0)));

      // remove to see effect without rescaling
      L = L*scale_L;
      C = C*scale_L;

      let rgb = oklab_to_linear_srgb(L, C*a_, C*b_);
      return [
          255*srgb_transfer_function(rgb[0]),
          255*srgb_transfer_function(rgb[1]),
          255*srgb_transfer_function(rgb[2]),
      ]
  }

  function srgb_to_okhsv(r,g,b)
  {
      let lab = linear_srgb_to_oklab(
          srgb_transfer_function_inv(r/255),
          srgb_transfer_function_inv(g/255),
          srgb_transfer_function_inv(b/255)
      );

      let C = Math.sqrt(lab[1]*lab[1] +lab[2]*lab[2]);
      let a_ = lab[1]/C;
      let b_ = lab[2]/C;

      let L = lab[0];
      let h = 0.5 + 0.5*Math.atan2(-lab[2], -lab[1])/Math.PI;

      let ST_max = get_ST_max(a_,b_);
      let S_max = ST_max[0];
      let S_0 = 0.5;
      let T = ST_max[1];
      let k = 1 - S_0/S_max;

      let t = T/(C+L*T);
      let L_v = t*L;
      let C_v = t*C;

      let L_vt = toe_inv(L_v);
      let C_vt = C_v * L_vt/L_v;

      let rgb_scale = oklab_to_linear_srgb(L_vt,a_*C_vt,b_*C_vt);
      let scale_L = Math.cbrt(1/(Math.max(rgb_scale[0],rgb_scale[1],rgb_scale[2],0)));

      L = L/scale_L;
      C = C/scale_L;

      C = C * toe(L)/L;
      L = toe(L);

      let v = L/L_v;
      let s = (S_0+T)*C_v/((T*S_0) + T*k*C_v)

      return [h,s,v];
  }

  function hex_to_rgb(hex)
  {
      if (hex.substr(0,1) == "#")
          hex = hex.substr(1);

      if (hex.match(/^([0-9a-f]{3})$/i))
      {
          let r = parseInt(hex.charAt(0),16)/15 * 255;
          let g = parseInt(hex.charAt(1),16)/15 * 255;
          let b = parseInt(hex.charAt(2),16)/15 * 255;
          return [r,g,b];
      }
      if (hex.match(/^([0-9a-f]{6})$/i))
      {
          let r = parseInt(hex.substr(0,2),16);
          let g = parseInt(hex.substr(2,2),16);
          let b = parseInt(hex.substr(4,2),16);
          return [r,g,b];
      }
      if (hex.match(/^([0-9a-f]{1})$/i))
      {
          let a = parseInt(hex.substr(0),16)/15 * 255;
          return [a,a,a];
      }
      if (hex.match(/^([0-9a-f]{2})$/i))
      {
          let a = parseInt(hex.substr(0,2),16);
          return [a,a,a];
      }

      return null;
  }

  function rgb_to_hex(r,g,b)
  {
      function componentToHex(x)
      {
          var hex = Math.round(x).toString(16);
          return hex.length == 1 ? "0" + hex : hex;
      }

      return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

  ColorSpace.register(new ColorSpace({
    id: "okhsl",
    name: "okHSL",
    base: ColorSpace.registry.srgb,
    coords: {
      h: {
        refRange: [0, 360],
        type: "angle",
        name: "Hue",
      },
      s: {
        refRange: [0, 100],
        name: "Saturation",
      },
      l: {
        refRange: [0, 100],
        name: "Lightness",
      },
    },
    fromBase(sRGB) {
      let [h, s, l] =  srgb_to_okhsl(...sRGB.map(c => c * 255));

      let hh = normalize(h * 360, 0, 360, 5);
      let ss = normalize(s * 100, 0, 100, 5);
      let ll = normalize(l * 100, 0, 100, 5);

      return [hh, ss, ll];
    },
    toBase(hsl) {
      let [h, s, l] = hsl;
      let [r, g, b] = okhsl_to_srgb(h/360, s/100, l/100);

      let rr = normalize(r / 255, 0, 1, 5);
      let gg = normalize(g / 255, 0, 1, 5);
      let bb = normalize(b / 255, 0, 1, 5);

      return [rr, gg, bb];
    },
    formats: {
      okhsl: {
        coords: ["<number>", "<number>", "<number>"]
      }
    }
  }));

  ColorSpace.register(new ColorSpace({
    id: "okhsv",
    name: "okHSV",
    base: ColorSpace.registry.srgb,
    coords: {
      h: {
        refRange: [0, 360],
        type: "angle",
        name: "Hue"
      },
      s: {
        refRange: [0, 100],
        name: "Saturation"
      },
      v: {
        refRange: [0, 100],
        name: "Value"
      },
    },
    fromBase(sRGB) {
      let [h, s, v] =  srgb_to_okhsv(...sRGB.map(c => c * 255));

      let hh = normalize(h * 360, 0, 360, 5);
      let ss = normalize(s * 100, 0, 100, 5);
      let vv = normalize(v * 100, 0, 100, 5);

      return [hh, ss, vv];
    },
    toBase(hsv) {
      let [h, s, v] = hsv;
      let [r, g, b] = okhsv_to_srgb(h/360, s/100, v/100);

      let rr = normalize(r / 255, 0, 1, 5);
      let gg = normalize(g / 255, 0, 1, 5);
      let bb = normalize(b / 255, 0, 1, 5);

      return [rr, gg, bb];
    },
    formats: {
      okhsv: {
        coords: ["<number>", "<number>", "<number>"]
      }
    }
  }));
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Register HSLuv color space
// @src: https://github.com/hsluv/hsluv-javascript/tree/main
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

{
  class Hsluv {
      constructor() {
          // RGB
          this.hex = '#000000';
          this.rgb_r = 0;
          this.rgb_g = 0;
          this.rgb_b = 0;
          // CIE XYZ
          this.xyz_x = 0;
          this.xyz_y = 0;
          this.xyz_z = 0;
          // CIE LUV
          this.luv_l = 0;
          this.luv_u = 0;
          this.luv_v = 0;
          // CIE LUV LCh
          this.lch_l = 0;
          this.lch_c = 0;
          this.lch_h = 0;
          // HSLuv
          this.hsluv_h = 0;
          this.hsluv_s = 0;
          this.hsluv_l = 0;
          // HPLuv
          this.hpluv_h = 0;
          this.hpluv_p = 0;
          this.hpluv_l = 0;
          // 6 lines in slope-intercept format: R < 0, R > 1, G < 0, G > 1, B < 0, B > 1
          this.r0s = 0;
          this.r0i = 0;
          this.r1s = 0;
          this.r1i = 0;
          this.g0s = 0;
          this.g0i = 0;
          this.g1s = 0;
          this.g1i = 0;
          this.b0s = 0;
          this.b0i = 0;
          this.b1s = 0;
          this.b1i = 0;
      }
      static fromLinear(c) {
          if (c <= 0.0031308) {
              return 12.92 * c;
          }
          else {
              return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
          }
      }
      static toLinear(c) {
          if (c > 0.04045) {
              return Math.pow((c + 0.055) / 1.055, 2.4);
          }
          else {
              return c / 12.92;
          }
      }
      static yToL(Y) {
          if (Y <= Hsluv.epsilon) {
              return Y / Hsluv.refY * Hsluv.kappa;
          }
          else {
              return 116 * Math.pow(Y / Hsluv.refY, 1 / 3) - 16;
          }
      }
      static lToY(L) {
          if (L <= 8) {
              return Hsluv.refY * L / Hsluv.kappa;
          }
          else {
              return Hsluv.refY * Math.pow((L + 16) / 116, 3);
          }
      }
      static rgbChannelToHex(chan) {
          const c = Math.round(chan * 255);
          const digit2 = c % 16;
          const digit1 = (c - digit2) / 16 | 0;
          return Hsluv.hexChars.charAt(digit1) + Hsluv.hexChars.charAt(digit2);
      }
      static hexToRgbChannel(hex, offset) {
          const digit1 = Hsluv.hexChars.indexOf(hex.charAt(offset));
          const digit2 = Hsluv.hexChars.indexOf(hex.charAt(offset + 1));
          const n = digit1 * 16 + digit2;
          return n / 255.0;
      }
      static distanceFromOriginAngle(slope, intercept, angle) {
          const d = intercept / (Math.sin(angle) - slope * Math.cos(angle));
          if (d < 0) {
              return Infinity;
          }
          else {
              return d;
          }
      }
      static distanceFromOrigin(slope, intercept) {
          return Math.abs(intercept) / Math.sqrt(Math.pow(slope, 2) + 1);
      }
      static min6(f1, f2, f3, f4, f5, f6) {
          return Math.min(f1, Math.min(f2, Math.min(f3, Math.min(f4, Math.min(f5, f6)))));
      }
      rgbToHex() {
          this.hex = "#";
          this.hex += Hsluv.rgbChannelToHex(this.rgb_r);
          this.hex += Hsluv.rgbChannelToHex(this.rgb_g);
          this.hex += Hsluv.rgbChannelToHex(this.rgb_b);
      }
      hexToRgb() {
          this.hex = this.hex.toLowerCase();
          this.rgb_r = Hsluv.hexToRgbChannel(this.hex, 1);
          this.rgb_g = Hsluv.hexToRgbChannel(this.hex, 3);
          this.rgb_b = Hsluv.hexToRgbChannel(this.hex, 5);
      }
      xyzToRgb() {
          this.rgb_r = Hsluv.fromLinear(Hsluv.m_r0 * this.xyz_x + Hsluv.m_r1 * this.xyz_y + Hsluv.m_r2 * this.xyz_z);
          this.rgb_g = Hsluv.fromLinear(Hsluv.m_g0 * this.xyz_x + Hsluv.m_g1 * this.xyz_y + Hsluv.m_g2 * this.xyz_z);
          this.rgb_b = Hsluv.fromLinear(Hsluv.m_b0 * this.xyz_x + Hsluv.m_b1 * this.xyz_y + Hsluv.m_b2 * this.xyz_z);
      }
      rgbToXyz() {
          const lr = Hsluv.toLinear(this.rgb_r);
          const lg = Hsluv.toLinear(this.rgb_g);
          const lb = Hsluv.toLinear(this.rgb_b);
          this.xyz_x = 0.41239079926595 * lr + 0.35758433938387 * lg + 0.18048078840183 * lb;
          this.xyz_y = 0.21263900587151 * lr + 0.71516867876775 * lg + 0.072192315360733 * lb;
          this.xyz_z = 0.019330818715591 * lr + 0.11919477979462 * lg + 0.95053215224966 * lb;
      }
      xyzToLuv() {
          const divider = this.xyz_x + 15 * this.xyz_y + 3 * this.xyz_z;
          let varU = 4 * this.xyz_x;
          let varV = 9 * this.xyz_y;
          if (divider !== 0) {
              varU /= divider;
              varV /= divider;
          }
          else {
              varU = NaN;
              varV = NaN;
          }
          this.luv_l = Hsluv.yToL(this.xyz_y);
          if (this.luv_l === 0) {
              this.luv_u = 0;
              this.luv_v = 0;
          }
          else {
              this.luv_u = 13 * this.luv_l * (varU - Hsluv.refU);
              this.luv_v = 13 * this.luv_l * (varV - Hsluv.refV);
          }
      }
      luvToXyz() {
          if (this.luv_l === 0) {
              this.xyz_x = 0;
              this.xyz_y = 0;
              this.xyz_z = 0;
              return;
          }
          const varU = this.luv_u / (13 * this.luv_l) + Hsluv.refU;
          const varV = this.luv_v / (13 * this.luv_l) + Hsluv.refV;
          this.xyz_y = Hsluv.lToY(this.luv_l);
          this.xyz_x = 0 - 9 * this.xyz_y * varU / ((varU - 4) * varV - varU * varV);
          this.xyz_z = (9 * this.xyz_y - 15 * varV * this.xyz_y - varV * this.xyz_x) / (3 * varV);
      }
      luvToLch() {
          this.lch_l = this.luv_l;
          this.lch_c = Math.sqrt(this.luv_u * this.luv_u + this.luv_v * this.luv_v);
          if (this.lch_c < 0.00000001) {
              this.lch_h = 0;
          }
          else {
              const hrad = Math.atan2(this.luv_v, this.luv_u);
              this.lch_h = hrad * 180.0 / Math.PI;
              if (this.lch_h < 0) {
                  this.lch_h = 360 + this.lch_h;
              }
          }
      }
      lchToLuv() {
          const hrad = this.lch_h / 180.0 * Math.PI;
          this.luv_l = this.lch_l;
          this.luv_u = Math.cos(hrad) * this.lch_c;
          this.luv_v = Math.sin(hrad) * this.lch_c;
      }
      calculateBoundingLines(l) {
          const sub1 = Math.pow(l + 16, 3) / 1560896;
          const sub2 = sub1 > Hsluv.epsilon ? sub1 : l / Hsluv.kappa;
          const s1r = sub2 * (284517 * Hsluv.m_r0 - 94839 * Hsluv.m_r2);
          const s2r = sub2 * (838422 * Hsluv.m_r2 + 769860 * Hsluv.m_r1 + 731718 * Hsluv.m_r0);
          const s3r = sub2 * (632260 * Hsluv.m_r2 - 126452 * Hsluv.m_r1);
          const s1g = sub2 * (284517 * Hsluv.m_g0 - 94839 * Hsluv.m_g2);
          const s2g = sub2 * (838422 * Hsluv.m_g2 + 769860 * Hsluv.m_g1 + 731718 * Hsluv.m_g0);
          const s3g = sub2 * (632260 * Hsluv.m_g2 - 126452 * Hsluv.m_g1);
          const s1b = sub2 * (284517 * Hsluv.m_b0 - 94839 * Hsluv.m_b2);
          const s2b = sub2 * (838422 * Hsluv.m_b2 + 769860 * Hsluv.m_b1 + 731718 * Hsluv.m_b0);
          const s3b = sub2 * (632260 * Hsluv.m_b2 - 126452 * Hsluv.m_b1);
          this.r0s = s1r / s3r;
          this.r0i = s2r * l / s3r;
          this.r1s = s1r / (s3r + 126452);
          this.r1i = (s2r - 769860) * l / (s3r + 126452);
          this.g0s = s1g / s3g;
          this.g0i = s2g * l / s3g;
          this.g1s = s1g / (s3g + 126452);
          this.g1i = (s2g - 769860) * l / (s3g + 126452);
          this.b0s = s1b / s3b;
          this.b0i = s2b * l / s3b;
          this.b1s = s1b / (s3b + 126452);
          this.b1i = (s2b - 769860) * l / (s3b + 126452);
      }
      calcMaxChromaHpluv() {
          const r0 = Hsluv.distanceFromOrigin(this.r0s, this.r0i);
          const r1 = Hsluv.distanceFromOrigin(this.r1s, this.r1i);
          const g0 = Hsluv.distanceFromOrigin(this.g0s, this.g0i);
          const g1 = Hsluv.distanceFromOrigin(this.g1s, this.g1i);
          const b0 = Hsluv.distanceFromOrigin(this.b0s, this.b0i);
          const b1 = Hsluv.distanceFromOrigin(this.b1s, this.b1i);
          return Hsluv.min6(r0, r1, g0, g1, b0, b1);
      }
      calcMaxChromaHsluv(h) {
          const hueRad = h / 360 * Math.PI * 2;
          const r0 = Hsluv.distanceFromOriginAngle(this.r0s, this.r0i, hueRad);
          const r1 = Hsluv.distanceFromOriginAngle(this.r1s, this.r1i, hueRad);
          const g0 = Hsluv.distanceFromOriginAngle(this.g0s, this.g0i, hueRad);
          const g1 = Hsluv.distanceFromOriginAngle(this.g1s, this.g1i, hueRad);
          const b0 = Hsluv.distanceFromOriginAngle(this.b0s, this.b0i, hueRad);
          const b1 = Hsluv.distanceFromOriginAngle(this.b1s, this.b1i, hueRad);
          return Hsluv.min6(r0, r1, g0, g1, b0, b1);
      }
      hsluvToLch() {
          if (this.hsluv_l > 99.9999999) {
              this.lch_l = 100;
              this.lch_c = 0;
          }
          else if (this.hsluv_l < 0.00000001) {
              this.lch_l = 0;
              this.lch_c = 0;
          }
          else {
              this.lch_l = this.hsluv_l;
              this.calculateBoundingLines(this.hsluv_l);
              const max = this.calcMaxChromaHsluv(this.hsluv_h);
              this.lch_c = max / 100 * this.hsluv_s;
          }
          this.lch_h = this.hsluv_h;
      }
      lchToHsluv() {
          if (this.lch_l > 99.9999999) {
              this.hsluv_s = 0;
              this.hsluv_l = 100;
          }
          else if (this.lch_l < 0.00000001) {
              this.hsluv_s = 0;
              this.hsluv_l = 0;
          }
          else {
              this.calculateBoundingLines(this.lch_l);
              const max = this.calcMaxChromaHsluv(this.lch_h);
              this.hsluv_s = this.lch_c / max * 100;
              this.hsluv_l = this.lch_l;
          }
          this.hsluv_h = this.lch_h;
      }
      hpluvToLch() {
          if (this.hpluv_l > 99.9999999) {
              this.lch_l = 100;
              this.lch_c = 0;
          }
          else if (this.hpluv_l < 0.00000001) {
              this.lch_l = 0;
              this.lch_c = 0;
          }
          else {
              this.lch_l = this.hpluv_l;
              this.calculateBoundingLines(this.hpluv_l);
              const max = this.calcMaxChromaHpluv();
              this.lch_c = max / 100 * this.hpluv_p;
          }
          this.lch_h = this.hpluv_h;
      }
      lchToHpluv() {
          if (this.lch_l > 99.9999999) {
              this.hpluv_p = 0;
              this.hpluv_l = 100;
          }
          else if (this.lch_l < 0.00000001) {
              this.hpluv_p = 0;
              this.hpluv_l = 0;
          }
          else {
              this.calculateBoundingLines(this.lch_l);
              const max = this.calcMaxChromaHpluv();
              this.hpluv_p = this.lch_c / max * 100;
              this.hpluv_l = this.lch_l;
          }
          this.hpluv_h = this.lch_h;
      }
      hsluvToRgb() {
          this.hsluvToLch();
          this.lchToLuv();
          this.luvToXyz();
          this.xyzToRgb();
      }
      hpluvToRgb() {
          this.hpluvToLch();
          this.lchToLuv();
          this.luvToXyz();
          this.xyzToRgb();
      }
      hsluvToHex() {
          this.hsluvToRgb();
          this.rgbToHex();
      }
      hpluvToHex() {
          this.hpluvToRgb();
          this.rgbToHex();
      }
      rgbToHsluv() {
          this.rgbToXyz();
          this.xyzToLuv();
          this.luvToLch();
          this.lchToHpluv();
          this.lchToHsluv();
      }
      rgbToHpluv() {
          this.rgbToXyz();
          this.xyzToLuv();
          this.luvToLch();
          this.lchToHpluv();
          this.lchToHpluv();
      }
      hexToHsluv() {
          this.hexToRgb();
          this.rgbToHsluv();
      }
      hexToHpluv() {
          this.hexToRgb();
          this.rgbToHpluv();
      }
  }

  Hsluv.hexChars = "0123456789abcdef";
  Hsluv.refY = 1.0;
  Hsluv.refU = 0.19783000664283;
  Hsluv.refV = 0.46831999493879;
  Hsluv.kappa = 903.2962962;
  Hsluv.epsilon = 0.0088564516;
  Hsluv.m_r0 = 3.240969941904521;
  Hsluv.m_r1 = -1.537383177570093;
  Hsluv.m_r2 = -0.498610760293;
  Hsluv.m_g0 = -0.96924363628087;
  Hsluv.m_g1 = 1.87596750150772;
  Hsluv.m_g2 = 0.041555057407175;
  Hsluv.m_b0 = 0.055630079696993;
  Hsluv.m_b1 = -0.20397695888897;
  Hsluv.m_b2 = 1.056971514242878;

  ColorSpace.register(new ColorSpace({
    id: "hsluv",
    name: "HSLuv",
    base: ColorSpace.registry.srgb,
    coords: {
      h: {
        refRange: [0, 360],
        type: "angle",
        name: "Hue",
      },
      s: {
        refRange: [0, 100],
        name: "Saturation",
      },
      l: {
        refRange: [0, 100],
        name: "Lightness",
      },
    },
    fromBase(rgb) {
      let [r, g, b] = rgb;

      let value = new Hsluv();
      value.rgb_r = r;
      value.rgb_g = g;
      value.rgb_b = b;
      value.rgbToHsluv();

      let hh = normalize(value.hsluv_h, 0, 360, 5);
      let ss = normalize(value.hsluv_s, 0, 100, 5);
      let ll = normalize(value.hsluv_l, 0, 100, 5);

      return [hh, ss, ll];
    },
    toBase(hsl) {
      let [h, s, l] = hsl;

      let value = new Hsluv();
      value.hsluv_h = h;
      value.hsluv_s = s;
      value.hsluv_l = l;
      value.hsluvToRgb();

      let rr = normalize(value.rgb_r, 0, 1, 5);
      let gg = normalize(value.rgb_g, 0, 1, 5);
      let bb = normalize(value.rgb_b, 0, 1, 5);

      return [rr, gg, bb];
    },
    formats: {
      hsluv: {
        coords: ["<number>", "<number>", "<number>"]
      }
    }
  }));
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @type
//   format = "hex" ||
//            "hsl" || "hwb" || "rgb" || "color" || "oklch" ||
//            "hsl-alt" || "hwb-alt" || "rgb-alt" || "color-alt" || "oklch-alt"
//   (format) => string
let prettySerializeColor = (color, format = "hex", precision = 3) => {
  // Hexadecimal, e.g."#bada5580"
  if (format === "hex") {
    return serializeColor(convertColor(color, "srgb"), {format: "hex"});
  }

  // HSL function, e.g. "hsl(74.4deg 64.3% 59.4% / 50%)" or "hsl(74.4 64.3% 59.4% / 0.5)"
  else if (format === "hsl" || format === "hsl-alt") {
    let [h, s, l] = convertColor(color, "hsl").coords;
    let a = color.alpha;

    if (Number.isNaN(h)) {
      h = 0;
    }

    h = toPrecision(h, precision);
    s = toPrecision(s, precision);
    l = toPrecision(l, precision);

    if (format === "hsl") {
      a = toPrecision(a * 100, precision);
      return (a === 100) ? `hsl(${h}deg ${s}% ${l}%)` : `hsl(${h}deg ${s}% ${l}% / ${a}%)`;
    }
    else if (format === "hsl-alt") {
      a = toPrecision(a, precision);
      return (a === 1) ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;
    }
  }

  // HWB function, e.g. "hwb(74.4deg 33.3% 14.5% / 50%)" or "hwb(74.4 33.3% 14.5% / 0.5)"
  else if (format === "hwb" || format === "hwb-alt") {
    let [h, w, b] = convertColor(color, "hwb").coords;
    let a = color.alpha;

    if (Number.isNaN(h)) {
      h = 0;
    }

    h = toPrecision(h, precision);
    w = toPrecision(w, precision);
    b = toPrecision(b, precision);

    if (format === "hwb") {
      a = toPrecision(a * 100, precision);
      return (a === 100) ? `hwb(${h}deg ${w}% ${b}%)` : `hwb(${h}deg ${w}% ${b}% / ${a}%)`;
    }
    else if (format === "hwb-alt") {
      a = toPrecision(a, precision);
      return (a === 1) ? `hwb(${h} ${w}% ${b}%)` : `hwb(${h} ${w}% ${b}% / ${a})`;
    }
  }

  // RGB function e.g. "rgb(72.9% 85.5% 33.3% / 50%)" or "rgb(186 218 85 / 0.5)"
  else if (format === "rgb" || format === "rgb-alt") {
    let [r, g, b] = convertColor(color, "srgb").coords;
    let a = color.alpha;

    if (format === "rgb") {
      r = toPrecision(r * 100, precision);
      g = toPrecision(g * 100, precision);
      b = toPrecision(b * 100, precision);
      a = toPrecision(a * 100, precision);

      return (a === 100) ? `rgb(${r}% ${g}% ${b}%)` : `rgb(${r}% ${g}% ${b}% / ${a}%)`
    }
    else if (format === "rgb-alt") {
      r = toPrecision(r * 255, precision);
      g = toPrecision(g * 255, precision);
      b = toPrecision(b * 255, precision);
      a = toPrecision(a, precision);

      return (a === 1) ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`;
    }
  }

  // Color function e.g. "color(srgb 72.9% 85.5% 33.3% / 50.2%)" or  "color(srgb 0.73 0.85 0.33 / 0.5)"
  else if (format === "color" || format === "color-alt") {
    if (color.spaceId === undefined) {
      color.spaceId = color.space.id;
    }

    if (["srgb", "srgb-linear", "a98rgb", "prophoto", "p3", "rec2020", "hsl", "hwb"].includes(color.spaceId)) {
      if (color.spaceId === "hsl" || color.spaceId === "hwb") {
        color = convertColor(color, "srgb");

        if (color.spaceId === undefined) {
          color.spaceId = color.space.id;
        }
      }

      let [r, g, b] = color.coords;
      let a = color.alpha;
      let space = color.spaceId;

      // Adjust names returned by Color.js to match CSS names
      if (color.spaceId === "p3") {
        space = "display-p3";
      }
      else if (color.spaceId === "a98rgb") {
        space = "a98-rgb";
      }
      else if (color.spaceId === "prophoto") {
        space = "prophoto-rgb";
      }

      if (format === "color") {
        r = toPrecision(r * 100, precision);
        g = toPrecision(g * 100, precision);
        b = toPrecision(b * 100, precision);
        a = toPrecision(a * 100, precision);

        return (a === 100) ? `color(${space} ${r}% ${g}% ${b}%)` : `color(${space} ${r}% ${g}% ${b}% / ${a}%)`;
      }
      else if (format === "color-alt") {
        r = toPrecision(r, precision);
        g = toPrecision(g, precision);
        b = toPrecision(b, precision);
        a = toPrecision(a, precision);

        return (a === 1) ? `color(${space} ${r} ${g} ${b})` : `color(${space} ${r} ${g} ${b} / ${a})`;
      }
    }
    else if (["xyz", "xyz-d50", "xyz-d65"].includes(color.spaceId)) {
      let [x, y, z] = color.coords;
      let a = color.alpha;
      let space = color.spaceId;

      if (format === "color") {
        x = toPrecision(x * 100, precision);
        y = toPrecision(y * 100, precision);
        z = toPrecision(z * 100, precision);
        a = toPrecision(a * 100, precision);

        return (a === 100) ? `color(${space} ${x}% ${y}% ${z}%)` : `color(${space} ${x}% ${y}% ${z}% / ${a}%)`;
      }
      else if (format === "color-alt") {
        x = toPrecision(x, precision);
        y = toPrecision(y, precision);
        z = toPrecision(z, precision);
        a = toPrecision(a, precision);

        return (a === 1) ? `color(${space} ${x} ${y} ${z})` : `color(${space} ${x} ${y} ${z} / ${a})`;
      }
    }
    else {
      throw new Error(`"Color in "${color.spaceId}" space can't be serialized to "${format}" format.`);
    }
  }

  // okLCH function, e.g. "oklch(84% 0.16 121.47deg / 50%)" or "oklch(0.84 0.16 121.47 / 0.5)"
  else if (format === "oklch" || format === "oklch-alt") {
    let [l, c, h] = convertColor(color, "srgb").coords;
    let a = color.alpha;

    if (format === "oklch") {
      l = toPrecision(l * 100, precision);
      c = toPrecision(c, precision);
      h = toPrecision(h, precision);
      a = toPrecision(a * 100, precision);

      return (a === 100) ? `oklch(${l}% ${c} ${h}deg)` : `oklch(${l}% ${c} ${h}deg / ${a}%)`;
    }
    else if (format === "oklch-alt") {
      l = toPrecision(l, precision);
      c = toPrecision(c, precision);
      h = toPrecision(h, precision);
      a = toPrecision(a, precision);

      return (a === 1) ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${a})`;
    }
  }

  else {
    throw new Error(`Unknown color format "${format}".`);
  }
};

// @type (string) => boolean
//
// Check if string contains valid CSS3 color, e.g. "blue", "#fff", "rgb(50, 50, 100)".
let isValidColorString = (string) => {
  try {
    parseColor(string);
  }
  catch (error) {
    return false;
  }

  return true;
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export {parseColor, convertColor, serializeColor, prettySerializeColor, isValidColorString};
