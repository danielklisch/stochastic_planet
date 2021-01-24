const vsSource = `#version 300 es

    in vec4 aVertexPosition;

    out lowp vec4 vPos;

    void main(void) {
        gl_Position = aVertexPosition;
        vPos = aVertexPosition;
        vPos.z *= 2.0;
    }
`;


const fsSource = `#version 300 es
    precision lowp float;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    in lowp vec4 vPos;

    out vec4 fragmentColor;

    uniform sampler2D _Color;
    uniform sampler2D _Height;
    uniform sampler2D _Clouds;
    uniform sampler2D _CloudsBlurred;
    uniform sampler2D _LUT_c;
    uniform sampler2D _LUT_h;
    uniform sampler2D _LUT_s;

    struct Matrix3x3 {
        float a;
        float b;
        float c;
        float d;
        float e;
        float f;
        float g;
        float h;
        float i;
    };
    Matrix3x3 mul(float f,Matrix3x3 m) {
        m.a *= f;
        m.b *= f;
        m.c *= f;
        m.d *= f;
        m.e *= f;
        m.f *= f;
        m.g *= f;
        m.h *= f;
        m.i *= f;
        return m;
    }
    vec3 mul(Matrix3x3 m,vec3 v) {
        vec3 w;
        w.x = m.a*v.x+m.b*v.y+m.c*v.z;
        w.y = m.d*v.x+m.e*v.y+m.f*v.z;
        w.z = m.g*v.x+m.h*v.y+m.i*v.z;
        return w;
    }
    Matrix3x3 NewMatrix(vec3 a,vec3 b,vec3 c) {
        Matrix3x3 m;
        m.a = a.x;
        m.b = b.x;
        m.c = c.x;
        m.d = a.y;
        m.e = b.y;
        m.f = c.y;
        m.g = a.z;
        m.h = b.z;
        m.i = c.z;
        return m;
    }
    float det(Matrix3x3 m) {
        return m.a*m.e*m.i+m.b*m.f*m.g+m.c*m.d*m.h-m.g*m.e*m.c-m.h*m.f*m.a-m.i*m.d*m.b;
    }
    Matrix3x3 inv(Matrix3x3 m) {
        Matrix3x3 n;
        n.a = m.e*m.i-m.f*m.h;
        n.b = m.c*m.h-m.b*m.i;
        n.c = m.b*m.f-m.c*m.e;
        n.d = m.f*m.g-m.d*m.i;
        n.e = m.a*m.i-m.c*m.g;
        n.f = m.c*m.d-m.a*m.f;
        n.g = m.d*m.h-m.e*m.g;
        n.h = m.b*m.g-m.a*m.h;
        n.i = m.a*m.e-m.b*m.d;
        n = mul(1.0/det(m),n);
        return n;
    }
    
    uniform float _Time;
    uniform float _Seed;
    uniform float _HeightScale;
    uniform float _HeightOffset;
    uniform float _TempScale;
    uniform float _TempOffset;
    uniform float _TempGrad;
    uniform float _LockHemi;
    uniform float _CloudsOffset;
    
    //pseudorandom number generator
    vec3 hash(vec3 v) {
        return vec3(fract(193.1*sin(93.46*v.x+64.39*v.y+83.36*v.z+65.83*_Seed)),
                    fract(140.4*sin(24.57*v.x+75.42*v.y+68.32*v.z+83.56*_Seed)),
                    fract(982.4*sin(82.65*v.x+56.28*v.y+15.72*v.z+13.46*_Seed)));
    }
    
    vec2 Rotate2D(vec2 pos,float a) {
        a *= 6.2831;
        return vec2(cos(a)*pos.x-sin(a)*pos.y,cos(a)*pos.y+sin(a)*pos.x);
    }

    //keep random position away from border since textures are not tileable
    //random patch has radius 0.1, so range should start at 0.1 and end at 0.9
    vec2 apply_margin(vec2 uv) {
        return 0.1+uv*0.8;
    }

    vec4 sample_texture(vec2 uv) {
        uv *= 1.0/4096.0;
        vec4 c = texture(_Color,uv);
        vec4 h = texture(_Height,uv);
        return vec4(c.rgb,h.r*256.0+h.g);
    }

    float w0(float a) {return (1.0/6.0)*(a*(a*(-a + 3.0) - 3.0) + 1.0);}
    float w1(float a) {return (1.0/6.0)*(a*a*(3.0*a - 6.0) + 4.0);}
    float w2(float a) {return (1.0/6.0)*(a*(a*(-3.0*a + 3.0) + 3.0) + 1.0);}
    float w3(float a) {return (1.0/6.0)*(a*a*a);}
    float g0(float a) {return w0(a) + w1(a);}
    float g1(float a) {return w2(a) + w3(a);}
    float h0(float a) {return -1.0 + w1(a) / (w0(a) + w1(a));}
    float h1(float a) {return 1.0 + w3(a) / (w2(a) + w3(a));}

    //bicubic texture filtering
    //based on https://www.shadertoy.com/view/4df3Dn
    vec4 bicubic(vec2 uv) {
        vec2 iuv = floor(uv);
        vec2 fuv = fract(uv);

        float g0x = g0(fuv.x);
        float g1x = g1(fuv.x);
        float h0x = h0(fuv.x);
        float h1x = h1(fuv.x);
        float h0y = h0(fuv.y);
        float h1y = h1(fuv.y);

        vec2 p0 = vec2(iuv.x + h0x, iuv.y + h0y)-0.5;
        vec2 p1 = vec2(iuv.x + h1x, iuv.y + h0y)-0.5;
        vec2 p2 = vec2(iuv.x + h0x, iuv.y + h1y)-0.5;
        vec2 p3 = vec2(iuv.x + h1x, iuv.y + h1y)-0.5;

        return g0(fuv.y)*(g0x*sample_texture(p0)+g1x*sample_texture(p1))+
               g1(fuv.y)*(g0x*sample_texture(p2)+g1x*sample_texture(p3));
    }
    
    //get random texture patch, project it onto sphere and return color
    vec4 color(vec3 index,vec3 p,float g) {
        vec3 n = normalize(index);
        vec3 rd = hash(index);
        vec3 dirU = normalize(cross(n,rd));
        vec3 dirV = normalize(cross(n,dirU));
        Matrix3x3 m = NewMatrix(dirU,dirV,n);
        m = inv(m);
        vec3 uvw = (normalize(p)-n)*g*0.1;
        uvw = mul(m,uvw);
        vec3 r = hash(index+vec3(42.0,42.0,42.0));
        vec2 uv = apply_margin(r.xy)+Rotate2D(uvw.xy,r.z);
        return bicubic(4096.0*uv);
    }
    
    //blend random texture patches
    //blending process depends on which face of a unit cube is closest to the point
    vec4 color(vec3 pos,float scale) {
        vec3 index = vec3(0.0,0.0,0.0);
        vec4 c = vec4(0.0,0.0,0.0,0.0);
        float g = scale*1.0;
        if (pos.x > abs(pos.z) && pos.x > abs(pos.y)) {
            pos *= g/abs(pos.x);
            index = floor(pos);
            index.x = g;
            vec2 uv = pos.zy-index.zy;
            c = (mix(mix(color(index+vec3(0.0,0.0,0.0),pos,g),color(index+vec3(0.0,0.0,1.0),pos,g),uv.x),
                     mix(color(index+vec3(0.0,1.0,0.0),pos,g),color(index+vec3(0.0,1.0,1.0),pos,g),uv.x),uv.y));
        }
        if (-pos.x > abs(pos.z) && -pos.x > abs(pos.y)) {
            pos *= g/abs(pos.x);
            index = floor(pos);
            index.x = -g;
            vec2 uv = pos.zy-index.zy;
            c = (mix(mix(color(index+vec3(0.0,0.0,0.0),pos,g),color(index+vec3(0.0,0.0,1.0),pos,g),uv.x),
                     mix(color(index+vec3(0.0,1.0,0.0),pos,g),color(index+vec3(0.0,1.0,1.0),pos,g),uv.x),uv.y));
        }
        if (pos.y > abs(pos.x) && pos.y > abs(pos.z)) {
            pos *= g/abs(pos.y);
            index = floor(pos);
            index.y = g;
            vec2 uv = pos.xz-index.xz;
            c = (mix(mix(color(index+vec3(0.0,0.0,0.0),pos,g),color(index+vec3(1.0,0.0,0.0),pos,g),uv.x),
                     mix(color(index+vec3(0.0,0.0,1.0),pos,g),color(index+vec3(1.0,0.0,1.0),pos,g),uv.x),uv.y));
        }
        if (-pos.y > abs(pos.x) && -pos.y > abs(pos.z)) {
            pos *= g/abs(pos.y);
            index = floor(pos);
            index.y = -g;
            vec2 uv = pos.xz-index.xz;
            c = (mix(mix(color(index+vec3(0.0,0.0,0.0),pos,g),color(index+vec3(1.0,0.0,0.0),pos,g),uv.x),
                     mix(color(index+vec3(0.0,0.0,1.0),pos,g),color(index+vec3(1.0,0.0,1.0),pos,g),uv.x),uv.y));
        }
        if (pos.z > abs(pos.x) && pos.z > abs(pos.y)) {
            pos *= g/abs(pos.z);
            index = floor(pos);
            index.z = g;
            vec2 uv = pos.xy-index.xy;
            c = (mix(mix(color(index+vec3(0.0,0.0,0.0),pos,g),color(index+vec3(1.0,0.0,0.0),pos,g),uv.x),
                     mix(color(index+vec3(0.0,1.0,0.0),pos,g),color(index+vec3(1.0,1.0,0.0),pos,g),uv.x),uv.y));
        }
        if (-pos.z > abs(pos.x) && -pos.z > abs(pos.y)) {
            pos *= g/abs(pos.z);
            index = floor(pos);
            index.z = -g;
            vec2 uv = pos.xy-index.xy;
            c = (mix(mix(color(index+vec3(0.0,0.0,0.0),pos,g),color(index+vec3(1.0,0.0,0.0),pos,g),uv.x),
                     mix(color(index+vec3(0.0,1.0,0.0),pos,g),color(index+vec3(1.0,1.0,0.0),pos,g),uv.x),uv.y));
        }
        return c;
    }
    
    //weights for neural network
    const float weights[237] = float[237](0.2623819,6.791082,-0.2135045,1.412286,-2.186535,-2.60881,0.2566189,-10.99568,-7.736709,0.9025754,-7.698434,5.678048,0.9018975,-7.154584,-18.26089,2.463973,1.604185,1.757222,-4.865029,1.658259,-0.3657086,-6.218855,-1.512541,-0.4471954,0.1853002,-1.030791,-0.9136777,-2.560745,0.5535468,-0.8751239,-1.045256,-4.902182,-0.3087796,1.232871,1.056408,-0.8308682,-3.341599,4.839209,1.970207,-0.04197787,-0.203705,-3.512557,-0.2308977,-0.05026855,0.1478058,-1.122374,-1.054786,-1.715856,0.6296373,-0.3215028,-1.11745,-3.069978,-0.5406819,0.9697977,-0.2065478,-0.09556285,-2.853607,3.593685,1.013407,-0.235232,0.2290688,1.065226,1.184998,-0.1874616,-0.5487689,-0.3180581,-1.144937,-0.4604813,0.8530005,-0.01461098,0.0590568,-0.7394118,-0.2123608,-0.4497037,0.2824296,0.5835584,-1.943921,-1.397297,0.3738435,-0.9574104,-3.926693,0.6713085,-3.169497,-4.380261,-3.351676,4.560379,-3.119412,9.883959,-3.064366,-3.856264,10.28582,7.757353,-3.692523,-4.054727,11.54287,-3.969436,19.22993,14.43356,-5.162251,-4.0529,2.354018,4.791652,1.220605,2.561049,3.174964,-1.871538,1.316414,6.23131,3.083713,2.087498,0.6612285,-1.502403,1.98763,3.005131,6.190883,2.620473,-5.77984,-4.082643,0.8619077,2.351615,1.17799,-0.7461409,0.6988958,3.691362,-0.6925639,-4.62937,-2.683073,2.735459,1.735428,3.668333,-0.1225147,-1.003302,1.642488,1.057315,-1.450491,1.593826,-0.5015897,1.675648,3.928655,1.136668,2.050644,-0.884739,0.2975312,4.750738,-3.060282,0.304411,1.27504,-0.6184961,-2.854639,-1.277406,-0.236966,-1.249784,0.8434873,2.299278,1.788663,-3.218442,0.03393603,-1.204616,0.2171946,-11.90002,1.382551,-0.3305757,-0.006166248,2.347746,-8.243472,0.8967118,-0.1809093,1.876042,2.533341,0.4355575,0.5256797,4.196739,-0.9799314,-1.721282,-6.907466,-3.76307,-4.491677,0.09065599,-1.613759,-5.721979,0.6471726,-0.2286908,-0.3582439,3.431516,1.029035,2.674648,1.062335,1.632854,4.480224,-7.957304,-3.164197,-1.826088,-0.8909281,-1.264076,10.52933,0.9132892,-0.251159,3.533141,1.789442,0.3764695,-0.07518965,16.23503,-0.8503145,-1.508167,5.119483,-6.895473,2.277224,-1.157423,-1.306946,3.035755,1.973691,1.929879,2.567478,1.225025,-5.028459,1.351935,-0.2995831,-1.090854,4.005341,2.265914,0.4093114,4.458661,0.1012166,-0.1918985,2.119587,-5.324459,-4.541648,-1.136423,3.4409,-0.7891862,-2.667974,2.173144,-4.114129,-3.94734,0.9333341,1.740549,2.174707);

    //activation function
    float sigmoid(float x) {
        x = exp(min(x,7.25));
        return x/(x+1.0);
    }
    
    //use neural network to predict LUT coordinates
    vec2 predict(float layer_0[5]) {
        float layer_1[20];
        for (int i1=0;i1<20;i1++) {
            layer_1[i1] = weights[100+i1];
            for (int j=0;j<5;j++) {
                layer_1[i1] += weights[j*20+i1]*layer_0[j];
            }
            layer_1[i1] = sigmoid(layer_1[i1]);
        }
        float layer_4[5];
        for (int i4=0;i4<5;i4++) {
            layer_4[i4] = weights[220+i4];
            for (int j=0;j<20;j++) {
                layer_4[i4] += weights[120+j*5+i4]*layer_1[j];
            }
            layer_4[i4] = sigmoid(layer_4[i4]);
        }
        float layer_5[2];
        for (int i5=0;i5<2;i5++) {
            layer_5[i5] = weights[235+i5];
            for (int j=0;j<5;j++) {
                layer_5[i5] += weights[225+j*2+i5]*layer_4[j];
            }
            layer_5[i5] = sigmoid(layer_5[i5]);
        }
        return vec2(layer_5[0],layer_5[1]);
    }
    
    //get LUT coordinates based on blend of random texture patches
    vec2 get_lut_uv(vec3 p) {
        vec4 c = vec4(0,0,0,0);
        float sum = 0.0;
        float f = 1.0;
        float s = 1.0;
        //repeat blending process on different scales to get more detail
        for (int i=0;i<4;i++) {
            c += color(p,f)*s;
            sum += s;
            s /= 2.0;
            f *= 2.0;
        }
        c /= sum;

        //prepare input for neural network
        float layer_0[5];
        layer_0[0] = min(c.a*(_HeightScale-_HeightOffset)/8.0+_HeightOffset,1.0);
        layer_0[1] = c.r;
        layer_0[2] = c.g;
        layer_0[3] = c.b;
        //modify latitude based on temperature settings
        float y = -p.y;
        y = abs(y)*_LockHemi+y*(1.0-_LockHemi);
        y *= _TempScale;
        y = (pow(max(abs(y)+_TempOffset*_LockHemi,0.0),_TempGrad)+_TempOffset*_LockHemi)*y/max(abs(y),0.000001);
        y += _TempOffset*(1.0-abs(_TempScale));
        layer_0[4] = (y+1.0)/2.0;
        return predict(layer_0);
    }
    
    //use lookup table to get color and height values
    vec4 get_lut_color(vec2 uv) {
        vec4 c = texture(_LUT_c,uv);
        vec4 h = texture(_LUT_h,uv);
        c.a = h.r+h.g/256.0;
        return c;
    }
    
    //distance of a point to the surface
    vec4 DE(vec3 p) {
        float d = length(p);
        vec4 c = get_lut_color(get_lut_uv(p/d));
        c.a = d-1.0-0.01*c.a;
        return c;
    }
    
    //gradient of the distance field gives the normal vector
    //based on http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
    vec3 normal(vec3 p,float d) {
        float _dx = 0.0001;
        return normalize(vec3(DE(p+vec3(_dx,0,0)).a-d,
                              DE(p+vec3(0,_dx,0)).a-d,
                              DE(p+vec3(0,0,_dx)).a-d));
    }

    //blackbody color based on temperature
    //based on http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
    vec3 blackbody(float t) {
        t *= 0.01;

        float r = 255.0;
        if (t>66.0) {
            r = 329.698727446*pow(t-60.0,-0.1332047592);
            r = min(max(r,0.0),255.0);
        }

        float g = 255.0;
        if (t<66.0) {
            g = 99.4708025861*log(t)-161.1195681661;
        }
        else {
            g = 288.1221695283 * pow(t-60.0,-0.0755148492);
        }
        g = min(max(g,0.0),255.0);

        float b = 255.0;
        if (t<66.0) {
            if (t<19.0) {
                b = 0.0;
            }
            else {
                b = 138.5177312231*log(t-10.0)-305.0447927307;
                b = min(max(b,0.0),255.0);
            }
        }
        return vec3(r,g,b)/255.0;
    }

    //get color of background
    vec3 background(vec3 dir) {
        vec3 sun = 50.0*pow(max(dir.z,0.0),20000.0)*vec3(1,1,1); //when dir.z is about 1 the ray is pointing at the sun
        float x = floor(dir.x*100.0);                            //partition background into boxes to display stars
        float y = floor(dir.y*100.0);
        float z = floor(dir.z*100.0);
        vec3 r = hash(vec3(x,y,z));                              //get random values for each box
        vec3 center = normalize(vec3(x+0.5,y+0.5,z+0.5));        //get center of box
        if (r.x<0.99) return sun;                                //discard 99% of boxes
        float f = max(1000000.0*(dot(center,dir)-0.999999),0.0); //when dir is pointing at center the ray is pointing at the star
        f *= r.y*r.z;                                            //brightness of the star, should correlate with temperature
        return sun+f*blackbody(r.z*r.z*30000.0);                 //get color of star based on its random temperature, add sunlight
    }
    
    //get sphere/ray intersections
    vec2 sphere_intersection(vec3 pos,vec3 dir,float r) {
        float b = dot(pos,dir);
        float c = dot(pos,pos)-r*r;
        float d = b*b-c;
        if (d<0.0) {
            return vec2(-1,-1);
        }
        return vec2(-b-sqrt(d),-b+sqrt(d));
    }

    //3D perlin noise, simple linear interpolation of random values at integer coordinates
    vec3 perlin(vec3 p) {
        vec3 n = floor(p);
        vec3 f = p-n;
        return mix(mix(mix(hash(n+vec3(0.0,0.0,0.0)),hash(n+vec3(1.0,0.0,0.0)),f.x),
        mix(hash(n+vec3(0.0,1.0,0.0)),hash(n+vec3(1.0,1.0,0.0)),f.x),f.y),
        mix(mix(hash(n+vec3(0.0,0.0,1.0)),hash(n+vec3(1.0,0.0,1.0)),f.x),
        mix(hash(n+vec3(0.0,1.0,1.0)),hash(n+vec3(1.0,1.0,1.0)),f.x),f.y),f.z);
    }

    //get cloud density
    float get_clouds(vec3 p,float intensity) {
        //convert cartesian to polar coordinates
        float y = asin(p.y);
        vec3 c = p/cos(y);
        float x = atan(c.z,c.x);
        x = x/6.2831;
        y = y/3.1415+0.5;
        //blend randomly rotated copies of the cloud texture
        vec3 r = hash(vec3(1,1,1));
        float clouds = texture(_Clouds,vec2(x+r.x+_Time*0.0002,y)).r+texture(_Clouds,vec2(r.y-x-_Time*0.0001,y)).r+texture(_Clouds,vec2(x+r.z,1-y)).r;
        //add perlin noise for high frequency detail
        p *= 2048.0;
        clouds += perlin(p).x*0.125;
        clouds += perlin(p*2.0).x*0.125;
        clouds += perlin(p*4.0).x*0.125;
        clouds += perlin(p*8.0).x*0.125;
        clouds -= 0.25;
        return min(max(clouds+intensity-(2.0-_CloudsOffset),0.0),1.0);
    }

    //get blurred cloud density
    //uses blurred texture and no perlin noise
    float get_clouds_blurred(vec3 p,float intensity) {
        float y = asin(p.y);
        vec3 c = p/cos(y);
        float x = atan(c.z,c.x);
        x = x/6.2831;
        y = y/3.1415+0.5;
        vec3 r = hash(vec3(1,1,1));
        float clouds = texture(_CloudsBlurred,vec2(x+r.x+_Time*0.0002,y)).r+texture(_CloudsBlurred,vec2(r.y-x-_Time*0.0001,y)).r+texture(_CloudsBlurred,vec2(x+r.z,1-y)).r;
        return min(1.5*max(clouds+intensity-(2.0-_CloudsOffset),0.0),1.0);
    }

    void main(void) {
        //get camera position and ray direction relative to the planet
        vec3 center = (inverse(uModelViewMatrix)*vec4(0,0,0,1)).xyz;
        vec3 pos = (inverse(uModelViewMatrix)*uProjectionMatrix*vPos).xyz;
        vec3 dir = normalize(pos-center);
        pos = center;
        
        //start with background color
        fragmentColor = vec4(background(dir),1);

        //test if ray intersect the atmosphere
        vec2 intersect_atmo = sphere_intersection(pos,dir,1.02);
        if (intersect_atmo.x<0.0) return;
        
        //light contribution from atmospheric scattering
        intersect_atmo.y = (intersect_atmo.x+intersect_atmo.y)/2.0;
        vec3 pos_atmo = pos+intersect_atmo.x*dir;
        float lAtmo = min(pos_atmo.z+1.0,1.0);
        lAtmo *= lAtmo;
        
        //test if ray intersect the planet
        vec4 sc = vec4(0,0,0,0);
        vec2 intersect_plnt = sphere_intersection(pos,dir,1.0);
        if (intersect_plnt.x>0.0) {
            intersect_atmo.y = min(intersect_atmo.y,intersect_plnt.x);
            vec3 pos_plnt = pos+intersect_plnt.x*dir;

            //get surface color and height
            vec2 uv = get_lut_uv(pos_plnt);
            vec4 c = get_lut_color(uv);
            c.a = -0.01*c.a;
            
            //calculate diffuse and specular lighting based on normal
            vec3 n = normal(pos_plnt,c.a);
            float lDiff = n.z;
            
            //get specularity and cloud coverage
            sc = texture(_LUT_s,uv);
            float fSpec = sc.r;
            if (fSpec>0.9) n = pos_plnt;
            vec3 refl = dir-2.0*n*dot(n,dir);
            float lSpec = 0.666*pow(max(refl.z,0.0),100.0);
            lSpec *= fSpec;

            //apply cloud shadows
            lDiff *= 1.0-get_clouds_blurred(normalize(pos_plnt+vec3(0,0,-1)*sphere_intersection(pos_plnt,vec3(0,0,-1),1.003).x),sc.g);
            if (lSpec>0.01) {
                lSpec *= 1.0-get_clouds(normalize(pos_plnt-refl*sphere_intersection(pos_plnt,-refl,1.003).x),sc.g);
            }
            
            //background color is replaced with planet color
            fragmentColor = vec4(c.rgb*max(lDiff,0.1*lAtmo)+lSpec*vec3(1,1,1),1);
        }
        
        //test if ray intersect the cloud sphere
        vec2 intersect_cloud = sphere_intersection(pos,dir,1.003);
        if (intersect_cloud.x>0.0) {
            vec3 pos_cloud = normalize(pos+intersect_cloud.x*dir);
            float clouds = get_clouds(pos_cloud,sc.g);
            fragmentColor.rgb = vec3(1,1,1)*max(pos_cloud.z,0.1*lAtmo)*clouds+fragmentColor.rgb*(1.0-clouds);
        }
        
        //add atmosphere color
        fragmentColor += lAtmo*2.0*max(intersect_atmo.y-intersect_atmo.x,0.0)*vec4(0.2,0.4,0.8,0.0);
    }
`;
