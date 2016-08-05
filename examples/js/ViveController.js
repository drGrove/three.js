THREE.ViveController = function (id) {
	THREE.Object3D.call(this);
  this.matrixAutoUpdate = false;
	this.standingMatrix = new THREE.Matrix4();

	var scope = this;

	this.gamepad;
	this.buttons;
	this.id = id;
	this.heldObject;
	this.trackpad = (function() {
		/**
		 * Internal State of the Trackpad axes position
		 * @type {Object<string><float32>}
		 * @private
		 */
		var axes_ = {
			x: 0,
			y: 0
		};

		/**
		 * Internal State of the Trackpad
		 * @type {Boolean}
		 * @private
		 */
		var touched_ = false;

		/**
		 * Informs of the touch state of the trackpad
		 * @public
		 * @function
		 * @returns {Boolean}
		 */
		var isTouched = function() {
			return touched_;
		}

		/**
		 * Sets the touch state of the trackpad
		 * @public
		 * @function
		 * @param {Boolean} state - the touch state of the trackpad
		 */
		var setTouched = function(state) {
			touched_ = state;
		}

		/**
		 * Informs of the {x, y} axes state of the touchpad
		 * @public
		 * @returns {Object<string><float32>}
		 */
		var getAxes = function() {
			return axes_;
		}

		/**
		 * Sets the axes state of the touchpad
		 * @public
		 * @param {Array<float32>} axes
		 */
		var setAxes = function(axes) {
			axes_ = {
				x: parseFloat(axes[0]) || 0,
				y: parseFloat(axes[1]) || 0
			}
		}

		return {
			setTouched: setTouched,
			isTouched: isTouched,
			getAxes: getAxes,
			setAxes: setAxes
		};
	})();

	/**
	 * @type {Object<string><integer>}
	 */
	this.BUTTONS = {
		TRACKPAD: 0,
		TRIGGER: 1,
		GRIP: 2,
		MENU: 3
	};

	/**
	 * @private
	 * @type {Object<string><string>}
	 */
	this.MAPPINGS = {};
	// Map buttons
	for (var key in this.BUTTONS) {
		this.MAPPINGS[key] = key;
	}

	/**
	 * Get the mapping name for a button by number
	 * @param {number} num - the button number
	 * @returns {string} mapping
	 */
	this.getMappingForButton = function (num) {
		for (var key in this.BUTTONS) {
			if (this.BUTTONS.hasOwnProperty(key)) {
				if (parseInt(this.BUTTONS[key]) === parseInt(num, 10)) {
					return key;
				}
			}
		}
		throw new Error('Mapping not found.');
	}

	this.getIdForMapping = function(mapping) {
		mapping = mapping.toUpperCase();
		if (this.BUTTONS[mapping]) {
			return this.BUTTONS[mapping]
		}
		throw new Error('Mapping not found.');
	}

		// unit vector direction of controller
	this.forward = function() {
		var matrix = new THREE.Matrix4();
		matrix.extractRotation( scope.matrix );

		var direction = new THREE.Vector3( 0, 0, -1 );
		direction.applyMatrix4(matrix);
		return direction;
	}

	// get position from matrix decomp
	// todo: figure out how to actually update position
	this.getPosition = function() {
		var position = new THREE.Vector3();
		scope.matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
		return position;
	}

	function update() {
		requestAnimationFrame( update );
		var gamepad = navigator.getGamepads()[ id ];
		if ( gamepad !== undefined && gamepad.pose !== null ) {
			var pose = gamepad.pose;
			scope.gamepad = gamepad;
			scope.position.fromArray( pose.position );
			scope.quaternion.fromArray( pose.orientation );
			scope.matrix.compose( scope.position, scope.quaternion, scope.scale );
			scope.matrix.multiplyMatrices( scope.standingMatrix, scope.matrix );
			scope.matrixWorldNeedsUpdate = true;
			scope.visible = true;
			scope.setGamepadStates(gamepad);
		} else {
			scope.visible = false;
		}
	}
	update();
};



THREE.ViveController.prototype = Object.create( THREE.Object3D.prototype );
THREE.ViveController.prototype.constructor = THREE.ViveController;

/**
 *  Emits an event
 *  @param {string} eventName - The event name
 *  @param {object} detail - The event detail
 */
THREE.ViveController.prototype.emit = function(name, detail) {
	var customEvent = new CustomEvent(name, {detail: detail});
	window.dispatchEvent(customEvent);
}

THREE.ViveController.prototype.createButtonEventDetail = function(buttonId) {
	return {
		controller_id: this.id,
		button_id: buttonId,
		button_mapping: this.getMappingForButton(buttonId)
	};
}

/**
 * Aligns the Vive controllers' button state with the state of the HTML5 Gamepads' buttons it's mapped to.
 * NOTE: This function with call the vive controllers emitter function for necessary state
 * chages
 *
 * @param {Object} gamepad - HTML5 Gamepad Instance
 */
THREE.ViveController.prototype.setGamepadStates = function(gamepad) {
	if (!this.buttons) {
		this.buttons = JSON.parse(JSON.stringify(gamepad.buttons));
	}
	gamepad.buttons.map(function(button, idx) {
		var buttonEventDetail = this.createButtonEventDetail(idx);
		if (button.pressed && !this.buttons[idx].isHeld) {
			this.buttons[idx].isHeld = true;
			this.emit('gamepadButtonPressed', buttonEventDetail)
		}

		if (!button.pressed && this.buttons[idx].isHeld) {
			this.buttons[idx].isHeld = false;
			this.buttons[idx].touchHeld = false;
			if (this.getMappingForButton(idx) === this.MAPPINGS.TRACKPAD) {
				this.trackpad.setTouched(false);
			}
			this.emit('gamepadButtonReleased', buttonEventDetail);
		}

		if (button.touched) {
			if (this.getMappingForButton(idx) === this.MAPPINGS.TRACKPAD) {
				this.trackpad.setAxes(gamepad.axes);
			}
			if (!this.buttons[idx].isHeld || !this.buttons[idx].touchHeld) {
				this.buttons[idx].touchHeld = true;
				this.buttons[idx].touchWasHeld = true;
				if (this.getMappingForButton(idx) === this.MAPPINGS.TRACKPAD) {
					this.trackpad.setTouched(true);
				}
				this.emit('gamepadButtonTouched', buttonEventDetail);
			}
		}
		if (!button.touched) {
			this.buttons[idx].touchHeld = false;
			if (this.getMappingForButton(idx) === this.BUTTONS.TRACKPAD) {
				this.trackpad.setTouched(false);
			}
			if (this.buttons[idx].touchWasHeld) {
				this.buttons[idx].touchedWasHeld = false;
				this.emit('gamepadButtonUntouched', buttonEventDetail);
			}
		}
	}, this);
}
