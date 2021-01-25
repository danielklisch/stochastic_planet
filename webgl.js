var canvas;
var gl;
var programInfo;
var buffers;

var texture_color;
var texture_height;
var texture_clouds;
var texture_clouds_blurred;
var lut_c;
var lut_h;
var lut_s;

function main() {
    canvas = document.querySelector('#glcanvas');
    gl = canvas.getContext('webgl2');
    if (!gl) {alert('Unable to initialize WebGL2. Your browser or machine may not support it.');return;}

    texture_color = loadTexture(gl, 'textures/texture_color.jpg',true,true);
    texture_height = loadTexture(gl, 'textures/texture_height.png',true,true);
    texture_clouds = loadTexture(gl, 'textures/texture_clouds.jpg',true,false);
    texture_clouds_blurred = loadTexture(gl, 'textures/texture_clouds_blurred.jpg',true,false);
    lut_c = loadTexture(gl, 'textures/lut_c.png',true,true);
    lut_h = loadTexture(gl, 'textures/lut_h.png',true,true);    
    lut_s = loadTexture(gl, 'textures/lut_s.png',true,true);    
    
    const shaderProgram = initShaderProgram(vsSource, fsSource);

    programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        },
    };

    buffers = initBuffers();

    resizeCanvas();

    var then = 0;

    function render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - then;
        then = now;

        handleInput(now,deltaTime);
        drawScene(now);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

function initBuffers() {
    const positionBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    gl.bufferData(gl.ARRAY_BUFFER,
                  new Float32Array(get_positions()),
                  gl.STATIC_DRAW);

    return {
        position: positionBuffer,
    };
}

function loadTexture(gl, url,linear,clamp) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  const image = new Image();
  image.crossOrigin = undefined;
  image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);
        
        if (clamp) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        if (linear) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        }
  };

  console.log("downloading...");
  image.src = url;
  console.log("finished!");

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

function drawScene(now) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = 45 * Math.PI / 180;   // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.01;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    mat4.identity(projectionMatrix);
    projectionMatrix[0] = aspect;

    const modelViewMatrix = mat4.create();

    mat4.translate(modelViewMatrix,modelViewMatrix,[0.0, 0.0, -distance]);

    mat4.rotateX(modelViewMatrix,modelViewMatrix,pos_y);
    
    mat4.rotateY(modelViewMatrix,modelViewMatrix,pos_x);

    {
        const numComponents = 3;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
        gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
    }

    gl.useProgram(programInfo.program);
    
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_Time"),         now);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_Seed"),         document.getElementById("input_Seed").value);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_HeightScale"),  document.getElementById("input_HeightScale").value/100.0);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_HeightOffset"), document.getElementById("input_HeightOffset").value/100.0);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_TempScale"),    document.getElementById("input_TempScale").value);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_TempOffset"),   document.getElementById("input_TempOffset").value/100.0);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_TempGrad"),     document.getElementById("input_TempGrad").value/100.0);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_LockHemi"),     document.getElementById("input_LockHemi").value);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_CloudsOffset"), document.getElementById("input_Clouds").value/100.0);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "_TidalLock"),     document.getElementById("input_TidalLock").value);
    
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix,false,projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix,false,modelViewMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture_color);
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_Color'), 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture_height);
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_Height'), 1);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, lut_c);
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_LUT_c'), 2);
    
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, lut_h);    
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_LUT_h'), 3);
    
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, lut_s);    
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_LUT_s'), 4);    

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, texture_clouds);    
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_Clouds'), 5);    
    
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, texture_clouds_blurred);    
    gl.uniform1i(gl.getUniformLocation(programInfo.program, '_CloudsBlurred'), 6);       
    
    {
        const offset = 0;
        const vertexCount = 6;
        gl.drawArrays(gl.TRIANGLES, offset, vertexCount);
    }
}

function initShaderProgram(vsSource, fsSource) {
    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(type, source) {
    const shader = gl.createShader(type);

    // Send the source to the shader object

    gl.shaderSource(shader, source);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function resizeCanvas() {  
    var width = canvas.clientWidth*document.getElementById("Resolution").value/100.0;
    var height = canvas.clientHeight*document.getElementById("Resolution").value/100.0;
    if (canvas.width != width || canvas.height != height) {
        canvas.width = width;
        canvas.height = height;
    }
}

function randomize() {
    document.getElementById("input_Seed").value = Math.round(9999*Math.random());
    document.getElementById("input_HeightScale").value = Math.round(50+100*Math.random());
    document.getElementById("input_HeightOffset").value = Math.round(-50+100*Math.random());
    document.getElementById("input_TempScale").value = Math.round(-1+2*Math.random());
    document.getElementById("input_TempOffset").value = Math.round(-100+200*Math.random());
    document.getElementById("input_TempGrad").value = Math.round(50+250*Math.random());
    document.getElementById("input_LockHemi").value = Math.round(Math.random());
    document.getElementById("input_Clouds").value = Math.round(-50+150*Math.random());
}

window.addEventListener('resize', resizeCanvas);
main();
