import {Util} from './util.js';
import {NiiVue} from './frameworks/niivue.js';

export class Boostlet {

  constructor() {
    this.framework = null;
  }

  /**
   * Initializes the Boostlet.
   * 
   * This includes several steps such as identifying the 
   * visualization/rendering framework that is available. 
   * 
   * TODO: Later we want to have fallbacks in place if the framework
   * is not detected.
   * 
   */
  init(name, instance) {

    if (typeof name != 'undefined' && typeof instance != 'undefined') {

      // ES module pages (e.g. NiiVue 1.0) keep the instance off window: Boostlet.init('niivue', nv)
      if (name !== 'niivue') throw "Forced Framework Not Implemented.";
      this.framework = new NiiVue(instance);

    } else {

      this.framework = Util.detect_framework();

    }

    if (this.framework) {

      console.log('Found', this.framework.name, '!')
    
    } else {

      throw "Framework Not Found.";

    }

  }

  /**
   * Let's the user select a region of interest box.
   */
  async select_box(callback) {

    this.framework.select_box(callback);

  }

  /**
   * Let's the user select (multiple) seeds.
   */
  async select_seed(howmany) {

    throw "Missing Implementation.";

  }

  /**
   * Loads an external javascript file asynchronously. 
   */
  async load_script(url, callback) {

    Util.load_script(url, callback);

  }

  /**
   * Sends a HTTP POST request to a url with some data.
   */
  async send_http_post(url, data, callback) {

    Util.send_http_post(url, data, callback);

  }

  /**
   * Gets the current image (2D).
   * 
   * TODO: Optional bounding box should be supported.
   * 
   */
  get_image(from_canvas) {

    return this.framework.get_image(from_canvas);

  }

  /**
   * Sets the current image (2D).
   * 
   */
  set_image(new_pixels) {

    return this.framework.set_image(new_pixels);

  }

  /**
   * Sets the current mask (2D).
   * 
   */
  set_mask(new_mask) {

    return this.framework.set_mask(new_mask);

  }

  /**
   * NiiVue: callback(location) on every crosshair move, and once immediately.
   * location.vox is the crosshair in RAS voxel coords (as get_subvolume takes).
   */
  on_location(callback) {
    return this.framework.on_location(callback);
  }

  /**
   * NiiVue: 0 axial, 1 coronal, 2 sagittal, 3 multiplanar, 4 render.
   */
  slice_type() {
    return this.framework.slice_type();
  }

  get_dims() {
    return this.framework.get_dims();
  }

  get_subvolume(start, end) {
    return this.framework.get_subvolume(start, end);
  }

  /**
   * Encode raw image data to PNG.
   */
  convert_to_png(uint8array, width, height) {

    return this.framework.convert_to_png(uint8array, width, height);

  }

  filter(pixels, width, height, kernel) {

    return Util.filter(pixels, width, height, kernel);

  }

  /**
   * Displays a small div located at the top left corner of the screen 
   * with message and will disappear after the specified time (ms).
   */
  hint(message, duration) {

    return Util.hint(message, duration);

  }

}
