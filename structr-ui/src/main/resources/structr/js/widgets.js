/*
 * Copyright (C) 2010-2022 Structr GmbH
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
let _Widgets = {
	defaultWidgetServerUrl: 'https://apps.structr.com/structr/rest/Widget',
	//defaultWidgetServerUrl: 'https://widgets.structr.org/structr/rest/Widget',
	widgetServerKey: 'structrWidgetServerKey_' + location.port,
	applicationConfigurationDataNodeKey: 'remote_widget_server',

	remoteWidgetData: [],
	remoteWidgetFilterEl: undefined,
	remoteWidgetsEl: undefined,
	localWidgetsEl: undefined,
	widgetServerSelector: undefined,

	localWidgetsCollapsedKey: 'structrWidgetLocalCollapsedKey_' + location.port,
	remoteWidgetsCollapsedKey: 'structrWidgetRemoteCollapsedKey_' + location.port,

	getContextMenuElements: function (div, entity) {

		let elements = [];

		elements.push({
			icon: _Icons.getSvgIcon('pencil_edit'),
			name: 'Edit',
			clickHandler: function () {

				Command.get(entity.id, 'id,type,name,source,configuration,description', function(entity) {
					_Widgets.editWidget(entity, true);
				});
				return false;
			}
		});

		_Elements.appendContextMenuSeparator(elements);

		elements.push({
			name: 'Properties',
			clickHandler: function() {
				_Entities.showProperties(entity, 'ui');
				return false;
			}
		});

		_Elements.appendContextMenuSeparator(elements);

		elements.push({
			icon: _Icons.getSvgIcon('trashcan'),
			classes: ['menu-bolder', 'danger'],
			name: 'Delete Widget',
			clickHandler: () => {

				_Entities.deleteNode(this, entity);
				return false;
			}
		});

		_Elements.appendContextMenuSeparator(elements);

		return elements;
	},

	reloadWidgets: () => {

		fastRemoveAllChildren(_Pages.widgetsSlideout);

		let templateConfig = {
			localCollapsed: LSWrapper.getItem(_Widgets.localWidgetsCollapsedKey, false),
			remoteCollapsed: LSWrapper.getItem(_Widgets.remoteWidgetsCollapsedKey, false)
		};

		_Pages.widgetsSlideout.append(_Widgets.templates.slideout(templateConfig));

		for (let toggleLink of _Pages.widgetsSlideout[0].querySelectorAll('a.tab-group-toggle')) {

			toggleLink.addEventListener('click', function(event) {
				let tabGroup = event.target.closest('.tab-group');
				tabGroup.classList.toggle('collapsed');
				LSWrapper.setItem(tabGroup.dataset.key, tabGroup.classList.contains('collapsed'));
			});
		}

		_Widgets.localWidgetsEl = $('#widgets', _Pages.widgetsSlideout);

		$('.add_widgets_icon', _Pages.widgetsSlideout).on('click', function(e) {
			e.preventDefault();
			Command.create({type: 'Widget'});
		});

		_Widgets.localWidgetsEl.droppable({
			drop: function(e, ui) {
				e.preventDefault();
				e.stopPropagation();
				_Elements.dropBlocked = true;
				var sourceId = Structr.getId($(ui.draggable));
				var sourceWidget = StructrModel.obj(sourceId);

				if (sourceWidget && sourceWidget.isWidget) {

					if (sourceWidget.treePath) {
						Command.create({ type: 'Widget', name: sourceWidget.name + ' (copied)', source: sourceWidget.source, description: sourceWidget.description, configuration: sourceWidget.configuration }, (entity) => {
							_Elements.dropBlocked = false;
						});
					}

				} else if (sourceId) {

					fetch(`${Structr.viewRootUrl}${sourceId}?${Structr.getRequestParameterName('edit')}=1`).then(async response => {

						if (response.ok) {

							let text = await response.text();

							Command.createLocalWidget(sourceId, 'New Widget (' + sourceId + ')', text, (entity) => {
								_Elements.dropBlocked = false;
							});
						}
					});
				}
			}
		});

		_Pager.initPager('local-widgets', 'Widget', 1, 1000, 'treePath', 'asc');
		let _wPager = _Pager.addPager('local-widgets', _Widgets.localWidgetsEl, true, 'Widget', 'public', (entities) => {

			for (let entity of entities) {
				StructrModel.create(entity, null, false);
				_Widgets.appendWidgetElement(entity, false, _Widgets.localWidgetsEl);
			}
		}, undefined, undefined, undefined, true);

		_wPager.appendFilterElements('<span style="white-space: nowrap;">Filter: <input type="text" class="filter" data-attribute="name"></span>');
		_wPager.activateFilterElements();
		_wPager.setIsPaused(false);
		_wPager.refresh();

		_Widgets.remoteWidgetsEl = $('#remoteWidgets', _Pages.widgetsSlideout);

		_Widgets.remoteWidgetFilterEl = $('#remoteWidgetsFilter');
		_Widgets.remoteWidgetFilterEl.keyup(function (e) {
			if (e.keyCode === 27) {
				$(this).val('');
			}

			_Widgets.repaintRemoteWidgets();
		});

		document.querySelector('.edit-widget-servers').addEventListener('click', _Widgets.showWidgetServersDialog);

		_Widgets.updateWidgetServerSelector(() => {
			_Widgets.refreshRemoteWidgets();
		});
	},
	getWidgetServerUrl: () => {

		if (_Widgets.widgetServerSelector) {

			let url = _Widgets.widgetServerSelector.value;
			if (url && url.toLowerCase().indexOf('/structr/rest/widget') === -1) {
				if (url.indexOf('/') === url.length) {
					// append REST path without /
					return url + 'structr/rest/Widget';
				} else {
					// append REST path with /
					return url + '/structr/rest/Widget';
				}
			}
			// else return unmodified URL
			return url;
		}
	},
	getConfiguredWidgetServers: (callback) => {

		Command.getApplicationConfigurationDataNodes(_Widgets.applicationConfigurationDataNodeKey, null, (appConfigDataNodes) => {

			appConfigDataNodes.push({id: '', name: 'default', content: _Widgets.defaultWidgetServerUrl, editable: false});

			callback(appConfigDataNodes);
		});
	},
	showWidgetServersDialog: () => {

		Structr.dialog('Widget Servers');
		dialogText.html(_Widgets.templates.serversDialog());

		Structr.activateCommentsInElement(dialogText[0], { helpElementCss: { 'font-size': '13px'} });

		_Widgets.updateWidgetServersTable();

		dialogText[0].querySelector('button#save-widget-server').addEventListener('click', () => {
			let name = document.querySelector('#new-widget-server-name').value;
			let url  = document.querySelector('#new-widget-server-url').value;

			Command.createApplicationConfigurationDataNode(_Widgets.applicationConfigurationDataNodeKey, name, url, () => {
				_Widgets.updateWidgetServersTable();
				_Widgets.updateWidgetServerSelector();
			});
		});
	},
	updateWidgetServersTable: () => {

		_Widgets.getConfiguredWidgetServers((appConfigDataNodes) => {

			let html = _Widgets.templates.serversTable({ servers: appConfigDataNodes });
			let container = dialogText[0].querySelector('#widget-servers-container');

			container.innerHTML = html;

			for (let deleteIcon of container.querySelectorAll('.delete')) {

				deleteIcon.addEventListener('click', function(e) {

					let el     = e.target;
					let acdnID = el.closest('div').dataset.acdnId;

					Structr.confirmation('Really delete Widget Server URL?', () => {

						Command.deleteNode(acdnID, false, function() {

							let currentServer = LSWrapper.getItem(_Widgets.widgetServerKey);
							let needsRefresh = (_Widgets.widgetServerSelector.value === currentServer);
							if (needsRefresh) {
								LSWrapper.removeItem(_Widgets.widgetServerKey);
							}

							_Widgets.updateWidgetServerSelector(() => {
								if (needsRefresh) {
									_Widgets.refreshRemoteWidgets();
								}
							});

							$.unblockUI({
								fadeOut: 25
							});

							_Widgets.showWidgetServersDialog();
						});
					}, () => {
						_Widgets.showWidgetServersDialog();
					});
				});
			}

			for (let input of container.querySelectorAll('input')) {

				input.addEventListener('change', (e) => {
					let el     = e.target;
					let acdnID = el.closest('div').dataset.acdnId;
					let key    = el.dataset.key;

					Command.setProperty(acdnID, key, el.value, false, () => {

						blinkGreen($(el));

						_Widgets.updateWidgetServerSelector();
					});
				});
			}
		});
	},
	updateWidgetServerSelector: (callback) => {

		_Widgets.getConfiguredWidgetServers((appConfigDataNodes) => {

			let templateConfig = {
				servers: appConfigDataNodes,
				selectedServerURL: LSWrapper.getItem(_Widgets.widgetServerKey, _Widgets.defaultWidgetServerUrl)
			};

			let newElement = Structr.createSingleDOMElementFromHTML(_Widgets.templates.serversSelector(templateConfig));

			if (_Widgets.widgetServerSelector && _Widgets.widgetServerSelector?.parentNode) {

				_Widgets.widgetServerSelector.replaceWith(newElement);

			} else {

				let selectorContainer = document.querySelector('#widget-server-selector-container');
				selectorContainer.prepend(newElement);
			}

			_Widgets.widgetServerSelector = document.querySelector('#widget-server-selector');
			_Widgets.widgetServerSelector.addEventListener('change', _Widgets.refreshRemoteWidgets);

			if (typeof callback === 'function') {
				callback();
			}
		});
	},
	refreshRemoteWidgets: () => {

		let url = _Widgets.getWidgetServerUrl();

		LSWrapper.setItem(_Widgets.widgetServerKey, url);

		if (!url.startsWith(document.location.origin)) {

			_Widgets.remoteWidgetsEl.empty();
			_Widgets.remoteWidgetData = [];

			_Widgets.fetchRemoteWidgets(url + '?sort=treePath&sort=name', url + '?_sort=treePath&_sort=name').then(function(data) {

				for (let entity of data) {
					let obj = StructrModel.create(entity, null, false);
					obj.srcUrl = url + '/' + entity.id;
					_Widgets.remoteWidgetData.push(obj);
				}

				_Widgets.repaintRemoteWidgets();

			}).catch((e) => {
				_Widgets.remoteWidgetFilterEl.hide();
				_Widgets.remoteWidgetsEl.empty();
				_Widgets.remoteWidgetsEl.html('Could not fetch widget data from server (' + url + '). Make sure that the resource loads correctly and check CORS settings.<br>Also check your adblocker settings for possible conflicts.');
			});

		} else {
			new MessageBuilder().warning().text('Can not display local widgets as remote widgets. Please select another widget server!').show();
		}
	},
	repaintRemoteWidgets: () => {

		_Widgets.remoteWidgetFilterEl.show();
		let search = _Widgets.remoteWidgetFilterEl.val();
		_Widgets.remoteWidgetsEl.empty();

		if (search && search.length > 0) {

			search = search.toLowerCase();

			for (let obj of _Widgets.remoteWidgetData) {
				if (obj.name.toLowerCase().indexOf(search) !== -1) {
					_Widgets.appendWidgetElement(obj, true, _Widgets.remoteWidgetsEl);
				}
			}

		} else {

			for (let obj of _Widgets.remoteWidgetData) {
				_Widgets.appendWidgetElement(obj, true, _Widgets.remoteWidgetsEl);
			}
		}

		_Pages.resize();
	},
	getTreeParent: (element, treePath, suffix) => {

		let parent = element;

		if (treePath) {

			let parts = treePath.split('/');
			let num = parts.length;

			for (let i = 0; i < num; i++) {

				var part = parts[i];
				if (part) {

					let lowerPart = part.toLowerCase().replace(/\W/g, '');
					let idString = lowerPart + suffix;
					let newParent = $('#' + idString + '_folder');

					if (newParent.length === 0) {
						_Widgets.appendFolderElement(parent, idString, _Icons.folder_icon, part);
						newParent = $('#' + idString + '_folder');
					}

					parent = newParent;
				}
			}

		} else {

			let idString = 'other' + suffix;
			let newParent = $('#' + idString + '_folder');

			if (newParent.length === 0) {
				_Widgets.appendFolderElement(parent, idString, _Icons.folder_icon, 'Uncategorized');
				newParent = $('#' + idString + '_folder');
			}

			parent = newParent;
		}

		return parent;
	},
	appendFolderElement: (parent, id, icon, name) => {

		let expanded = Structr.isExpanded(id);

		parent.append(`
			<div id="${id}_folder" class="widget node">
				<div class="node-container flex items-center">
					<i class="typeIcon ${_Icons.getFullSpriteClass(icon)}"></i>
					<b title="${escapeForHtmlAttributes(name)}" class="name flex-grow">${name}</b>
					<div id="${id}" class="node${expanded ? ' hidden' : ''}"></div>
				</div>
			</div>
		`);

		let div = $('#' + id + '_folder');

		_Widgets.appendVisualExpandIcon(div.children('.node-container'), id, name, true, false);
	},
	appendWidgetElement: function(widget, remote, el) {

		let icon   = _Icons.widget_icon;
		let parent = _Widgets.getTreeParent(el ? el : (remote ? _Widgets.remoteWidgetsEl : _Widgets.localWidgetsEl), widget.treePath, remote ? '_remote' : '_local');
		let div    = Structr.node(widget.id);

		if (!div) {

			parent.append(`
				<div id="id_${widget.id}" class="node widget">
					<div class="node-container flex items-center">
						<i class="typeIcon typeIcon-nochildren ${_Icons.getFullSpriteClass(icon)}"></i>
						<b title="${escapeForHtmlAttributes(widget.name)}" class="name_ flex-grow">${widget.name}</b>
						<div class="icons-container flex items-center"></div>
					</div>
				</div>
			`);
			div = Structr.node(widget.id);
		}

		let iconsContainer = div.children('.node-container').children('.icons-container');

		div.draggable({
			iframeFix: true,
			revert: 'invalid',
			containment: 'body',
			helper: 'clone',
			appendTo: '#main',
			stack: '.node',
			zIndex: 99
		});

		_Entities.setMouseOver(div, false);

		if (remote) {

			div.children('b.name_').off('click').css({cursor: 'move'});

			let eyeIcon = $(_Icons.getSvgIcon('eye_open', 16, 16, ['svg_eye_icon', 'icon-grey', 'cursor-pointer', 'node-action-icon']));
			iconsContainer.append(eyeIcon);

			eyeIcon.on('click', () => {
				_Widgets.editWidget(widget, false);
			});

		} else {

			_Entities.appendContextMenuIcon(iconsContainer, widget);

			_Elements.enableContextMenuOnElement(div, widget);
		}

		return div;
	},
	editWidget: function(entity, allowEdit) {

		Structr.dialog((allowEdit ? 'Edit widget "' : 'Source code of "') + entity.name + '"', () => {}, () => {}, ['popup-dialog-with-editor']);

		let id = "widget-dialog";
		dialogHead.append(`
			<div id="${id}_head">
				<div id="tabs">
					<ul id="widget-dialog-tabs">
						<li data-name="source">Source</li>
						<li data-name="config">Configuration</li>
						<li data-name="description">Description</li>
						<li data-name="selectors">Options</li>
						<li data-name="help">Help</li>
					</ul>
				</div>
			</div>
		`);
		dialogText.append(`<div id="${id}_content"></div>`);

		let mainTabs   = $('#tabs', dialogHead);
		let contentDiv = $('#' + id + '_content', dialogText);

		let ul = mainTabs.children('ul');

		let activateTab = function (tabName) {
			$('.widget-tab-content', contentDiv).hide();
			$('li', ul).removeClass('active');
			$('#tabView-' + tabName, contentDiv).show();
			$('li[data-name="' + tabName + '"]', ul).addClass('active');
			Structr.resize();

			_Editors.resizeVisibleEditors();
		};

		$('#widget-dialog-tabs > li', mainTabs).on('click', function(e) {
			activateTab($(this).data('name'));
		});

		contentDiv.append(`
			<div class="tab widget-tab-content h-full" id="tabView-source"><div class="editor h-full"></div></div>
			<div class="tab widget-tab-content h-full" id="tabView-config"><div class="editor h-full"></div></div>
			<div class="tab widget-tab-content h-full" id="tabView-description"><div class="editor h-full"></div></div>
			<div class="tab widget-tab-content" id="tabView-selectors"></div>
			<div class="tab widget-tab-content" id="tabView-help"></div>
		`);

		let changes = {};
		let widgetChanged = () => {
			let changed = false;
			for (let propertyName in changes) {
				changed = changed || changes[propertyName];
			}
			return changed;
		};

		let updateButtonStatus = () => {
			if (widgetChanged()) {
				dialogSaveButton.prop("disabled", false).removeClass('disabled');
				saveAndClose.prop("disabled", false).removeClass('disabled');
			} else {
				dialogSaveButton.prop("disabled", true).addClass('disabled');
				saveAndClose.prop("disabled", true).addClass('disabled');
			}
		};

		let editorChangeHandler = (editor, origEntity, propertyName) => {

			changes[propertyName] = ((entity[propertyName] || '') !== editor.getValue());

			if (allowEdit) {
				updateButtonStatus();
			}
		};

		let baseEditorConfig = {
			readOnly: !allowEdit,
			changeFn: editorChangeHandler
		};

		let sourceEditor      = _Editors.getMonacoEditor(entity, 'source',        contentDiv[0].querySelector('#tabView-source .editor'),      Object.assign({}, baseEditorConfig, { language: 'text/html', forceAllowAutoComplete: true }));
		let configEditor      = _Editors.getMonacoEditor(entity, 'configuration', contentDiv[0].querySelector('#tabView-config .editor'),      Object.assign({}, baseEditorConfig, { language: 'application/json' }));
		let descriptionEditor = _Editors.getMonacoEditor(entity, 'description',   contentDiv[0].querySelector('#tabView-description .editor'), Object.assign({}, baseEditorConfig, { language: 'text/html' }));

		// allow editing of selectors property
		_Schema.getTypeInfo(entity.type, (typeInfo) => {
			_Entities.listProperties(entity, 'editWidget', $('#tabView-selectors'), typeInfo);
		});

		let html = _Widgets.templates.help();
		$('#tabView-help', contentDiv).append(html);

		if (allowEdit) {

			dialogBtn.append(`
				<button id="editorSave" disabled="disabled" class="disabled">Save Widget</button>
				<button id="saveAndClose" disabled="disabled" class="disabled"> Save and close</button>
			`);

			dialogSaveButton = $('#editorSave', dialogBtn);
			saveAndClose     = $('#saveAndClose', dialogBtn);

			let saveWidgetFunction = (closeAfterSave) => {

				let widgetData = {
					source:        sourceEditor.getValue(),
					configuration: configEditor.getValue(),
					description:   descriptionEditor.getValue()
				};

				try {

					if (widgetData.configuration) {
						JSON.parse(widgetData.configuration);
					}

					Command.setProperties(entity.id, widgetData, () => {

						Structr.showAndHideInfoBoxMessage('Widget saved.', 'success', 2000, 200);

						if (closeAfterSave) {
							dialogCancelButton.click();
						} else {
							let modelObj = StructrModel.obj(entity.id);
							modelObj.source        = widgetData.source;
							modelObj.configuration = widgetData.configuration;
							modelObj.description   = widgetData.description;
							entity.source          = widgetData.source;
							entity.configuration   = widgetData.configuration;
							entity.description     = widgetData.description;

							changes = {};

							updateButtonStatus();
						}
					});

				} catch (e) {
					activateTab('config');
					alert('Configuration is not valid JSON - please review, otherwise the widget configuration dialog will not function correctly');
				}
			};

			saveAndClose.on('click', function() {
				saveWidgetFunction(true);
			});

			dialogSaveButton.on('click', function() {
				saveWidgetFunction(false);
			});
		}

		activateTab('source');
	},
	// appendWidgetSelectorEditor: function (container, entity, allowEdit) {
	//
	// 	let html = _Widgets.templates.editSelectors();
	// 	container.append(html);
	// },
	appendVisualExpandIcon: function(el, id, name, hasChildren, expand) {

		if (hasChildren) {

			let typeIcon            = $(el.children('.typeIcon').first());
			let icon                = $(el).children('.node').hasClass('hidden') ? _Icons.collapsedClass : _Icons.expandedClass;
			let expandIconClassName = 'expand_icon_svg';

			typeIcon.before(`<i class="${expandIconClassName} ${icon}"></i>`);

			let expandIcon = el.children('.' + expandIconClassName).first();

			let expandClickHandler = (e) => {
				e.stopPropagation();

				let childNodes = el.parent().children('.node');

				childNodes.toggleClass('hidden');

				let isCollapsed = childNodes.hasClass('hidden');
				if (isCollapsed) {
					Structr.addExpandedNode(id);
					expandIcon.removeClass(_Icons.expandedClass).addClass(_Icons.collapsedClass);
				} else {
					Structr.removeExpandedNode(id);
					expandIcon.removeClass(_Icons.collapsedClass).addClass(_Icons.expandedClass);
				}
			};

			$(el).on('click', expandClickHandler);

			let button = $(el.children('.' + expandIconClassName).first());

			if (button) {
				button.on('click', expandClickHandler);
			}

		} else {

			el.children('.typeIcon').css({
				paddingRight: '11px'
			});
		}
	},
	insertWidgetIntoPage: function(widget, target, pageId, callback) {

		let url               = _Widgets.getWidgetServerUrl();
		let widgetSource      = widget.source;
		let widgetDescription = widget.description;
		let widgetConfig      = widget.configuration;

		if (widgetConfig) {
			try {
				widgetConfig = JSON.parse(widgetConfig);
			} catch (e) {
				new MessageBuilder().error("Cannot parse Widget configuration").show();
				return;
			}
		}

		if (widgetSource) {

			if ((widgetDescription !== null && widgetDescription !== "") || widgetConfig ) {

				Structr.dialog('Configure Widget', function() {}, function() {});

				if ((widgetDescription === null || widgetDescription === "")) {
					dialogText.append('<p>Fill out the following parameters to correctly configure the widget.</p>');
				} else {
					dialogText.append(widgetDescription);
				}

				dialogText.append('<table class="props widget-props"></table>');

				let table = $('table', dialogText);

				let getOptionsAsText = (options, defaultValue) => {

					let buffer = '';

					if (Object.prototype.toString.call(options) === '[object Array]') {
						for (let option of options) {
							buffer += `<option ${((option === defaultValue) ? 'selected' : '')}>${option}</option>`;
						}

					} else if (Object.prototype.toString.call(options) === '[object Object]') {

						for (let option in options) {
							buffer += `<option ${((option === defaultValue) ? 'selected' : '')} value="${option}">${options[option]}</option>`;
						}
					}

					return buffer;
				};

				let sortedWidgetConfig = _Widgets.sortWidgetConfigurationByPosition(widgetConfig);

				for (let configElement of sortedWidgetConfig) {

					let label = configElement[0];
					if (label === 'processDeploymentInfo') {
						return;
					}

					let cleanedLabel = label.replace(/[^\w]/g, '_');

					let fieldConfig  = configElement[1];
					let fieldType    = fieldConfig.type;
					let defaultValue = fieldConfig.default || '';
					let titleLabel   = fieldConfig.title || label;
					let placeholder  = fieldConfig.placeholder || titleLabel;

					switch (fieldType) {
						case "select":
							let options = fieldConfig.options || ["-"];

							let buffer = `<tr><td><span id="label-${cleanedLabel}">${titleLabel}</span></td><td><select id="${cleanedLabel}" class="form-field" data-key="${label}">`;
							let delayedAppendFunction;

							if (fieldConfig.dynamicOptionsFunction) {

								let dynamicOptionsFunction = new Function("callback", fieldConfig.dynamicOptionsFunction);

								let delayedAppendOptions = function (options) {
									delayedAppendFunction = new function() {
										$('select#' + cleanedLabel).append(getOptionsAsText(options, defaultValue));
									};
								};

								dynamicOptionsFunction(delayedAppendOptions);

							} else {

								buffer += getOptionsAsText(options, defaultValue);
							}

							buffer += '</select></td></tr>';

							table.append(buffer);
							if (delayedAppendFunction) {
								delayedAppendFunction();
							}
							break;

						case "textarea":
							let rows = (fieldConfig.rows ? parseInt(fieldConfig.rows) || 5 : 5);
							table.append(`<tr><td><span id="label-${cleanedLabel}">${titleLabel}</span></td><td><textarea rows=${rows} class="form-field" id="${label}" placeholder="${placeholder}" data-key="${label}">${defaultValue}</textarea></td></tr>`);
							break;

						case "input":
						default:
							table.append(`<tr><td><span id="label-${cleanedLabel}">${titleLabel}</span></td><td><input class="form-field" type="text" id="${label}" placeholder="${placeholder}" data-key="${label}" value="${defaultValue}"></td></tr>`);
					}

					if (fieldConfig.help) {
						Structr.appendInfoTextToElement({
							text: fieldConfig.help,
							element: $('#label-' + cleanedLabel)
						});
					}
				}

				dialog.append('<button id="appendWidget">Append Widget</button>');

				$('#appendWidget').on('click', function(e) {

					let attrs = {};

					for (let field of table[0].querySelectorAll('.form-field')) {
						let key = field.dataset['key'];
						if (widgetConfig[key]) {
							attrs[key] = field.value;
						}
					}

					e.stopPropagation();
					Command.appendWidget(widgetSource, target.id, pageId, url, attrs, widgetConfig.processDeploymentInfo, callback);

					dialogCancelButton.click();
					return false;
				});

			} else {

				Command.appendWidget(widgetSource, target.id, pageId, url, {}, (widgetConfig ? widgetConfig.processDeploymentInfo : false), callback);
			}
		} else {
			new MessageBuilder().warning("Ignoring empty Widget").show();
		}
	},
	sortWidgetConfigurationByPosition: function (config) {
		let flattenedConfig = [];

		for (let key in config) {
			let val = config[key];
			flattenedConfig.push([val.position, key, val]);
		}

		let sortedConfig = flattenedConfig.sort(function (a, b) {
			return (a[0] - b[0]);
		});

		return sortedConfig.map(function(el) {
			return [el[1], el[2]];
		});
	},
	fetchRemotePageTemplateWidgets: async function() {

		let url = _Widgets.getWidgetServerUrl() || _Widgets.defaultWidgetServerUrl;

		LSWrapper.setItem(_Widgets.widgetServerKey, url);

		if (!url.startsWith(document.location.origin)) {

			let widgets = await _Widgets.fetchRemoteWidgets(url + '?isPageTemplate=true&_sort=name', url + '?isPageTemplate=true&sort=name');
			return widgets;
		}

		return [];
	},
	fetchLocalPageTemplateWidgets: async function() {

		try {
			let response = await fetch(Structr.rootUrl + 'Widget?isPageTemplate=true&' + Structr.getRequestParameterName('sort') + '=name');
			if (response && response.ok) {

				let json = await response.json();
				return json.result;
			}

		} catch (e) {}

		return [];
	},
	fetchAllPageTemplateWidgets: async () => {

		let widgets = [];

		let remotePageWidgets = await _Widgets.fetchRemotePageTemplateWidgets();
		let localPageWidgets  = await _Widgets.fetchLocalPageTemplateWidgets();

		return widgets.concat(remotePageWidgets).concat(localPageWidgets);
	},
	fetchRemoteWidgets: async (url, fallbackUrl) => {

		try {
			// stick with legacy sort parameter for widget instance - if a newer widget instance is used, retry with _sort
			let response = await fetch(url);

			if (response && response.ok) {

				let json = await response.json();
				return json.result;

			} else {

				let response = await fetch(fallbackUrl);
				if (response && response.ok) {

					let json = await response.json();
					return json.result;
				}
			}

		} catch (e) {}

		return [];
	},

	templates: {
		slideout: config => `
			${_Icons.getSvgIcon('circle_plus', 20, 20, _Icons.getSvgIconClassesNonColorIcon(['add_widgets_icon'], 'Create Widget'))}

			<div class="inner">

				<div class="tab-group${config.localCollapsed ? ' collapsed' : ''}" data-key="${_Widgets.localWidgetsCollapsedKey}">
					<a href="javascript:void(0);" class="tab-group-toggle">
						<h3 class="flex items-center">
							<i title="Expand Elements" class="expanded expand_icon_svg ${_Icons.expandedClass}"></i><i title="Expand Elements" class="collapsed expand_icon_svg ${_Icons.collapsedClass}"></i> Local Widgets
						</h3>
					</a>

					<div class="tab-group-content">
						<div id="widgets"></div>
					</div>
				</div>

				<div class="tab-group${config.remoteCollapsed ? ' collapsed' : ''}" data-key="${_Widgets.remoteWidgetsCollapsedKey}">
					<a href="javascript:void(0);" class="tab-group-toggle">
						<h3 class="flex items-center">
							<i title="Expand Elements" class="expanded expand_icon_svg ${_Icons.expandedClass}"></i><i title="Expand Elements" class="collapsed expand_icon_svg ${_Icons.collapsedClass}"></i> Remote Widgets
						</h3>
					</a>

					<div class="tab-group-content">
						<div class="flex items-center mb-4" id="widget-server-selector-container">
							${_Icons.getSvgIcon('list-cog', 20, 20, _Icons.getSvgIconClassesNonColorIcon(['edit-widget-servers', 'ml-1', 'mr-8'], 'Edit Widget Servers'))}

							<input placeholder="Filter..." size="10" id="remoteWidgetsFilter">
						</div>

						<div id="remoteWidgets"></div>
					</div>
				</div>
			</div>
		`,
		editSelectors: config => `
			<h5>CSS selectors</h5>
			<div id="selectors-container"></div>
		`,
		help: config => `
			<h2>Source</h2>
			<p>The source HTML code of the widget (enriched with structr expressions etc).</p>
			<p>The easiest way to get this source is to build the functionality in a Structr page and then "exporting" the source of the page. This can be done by using the "edit=1" URL parameter. This way the structr-internal expressions and configuration attributes are output without being evaluated.</p>
			<h4>Example</h4>
			<ol>
				<li>Create your widget in the page "myWidgetPage"</li>
				<li>Go to http://localhost:8082/myWidgetPage?edit=1</li>
				<li>View and copy the source code of that page</li>
				<li>Paste it into the "Source" tab of the "Edit Widget" dialog</li>
			</ol>

			<h2>Configuration</h2>
			<p>You can create advanced widgets and make them configurable by inserting template expressions in the widget source and adding the expression into the configuration. Template expressions look like this "[configSwitch]" and can contain any characters (except the closing bracket). If a corresponding entry is found in the configuration, a dialog is displayed when adding the widget to a page.</p>
			<p>Elements that look like template expressions are only treated as such if a corresponding entry is found in the configuration. This allows the use of square brackets in the widget source without it being interpreted as a template expression.</p>
			<p>The configuration must be a valid JSON string (and is validated as such when trying to save the widget).</p>
			<p>Have a look at the widget configuration of "configurable" widgets for more examples.</p>

			<h4>Basic example</h4>
			<pre>
			{
				"configSwitch": {
					"position": 2,
					"default": "This is the default text"
				},
				"selectArray": {
					"position": 3,
					"type": "select",
					"options": [
						"choice_one",
						"choice_two",
						"choice_three"
					],
					"default": "choice_two"
				},
				"selectObject": {
					"position": 1,
					"type": "select",
					"options": {
						"choice_one": "First choice",
						"choice_two": "Second choice",
						"choice_three": "Third choice"
					},
					"default": "choice_two"
				},
				"processDeploymentInfo": true,
			}</pre>

			<p>Reserved top-level words:</p>
			<ul>
				<li><b>processDeploymentInfo</b> (<i>boolean, default: false</i>)<br>Special configuration flag which allows the widgets to contain deployment annotations.</li>
			</ul>
			<p>The supported attributes of the configuration elements are the following:</p>
			<ul>
				<li><b>title</b><br>The title which is displayed in the left column of the "Add Widget to Page" dialog. If this value does not exist, the name of the template expression itself is used.</li>
				<li><b>placeholder</b> <i>(only applicable to type=input|textarea)</i><br>The placeholder text which is displayed when the field is empty. If this value does not exist, the <b>title</b> is used..</li>
				<li><b>default</b><br>The default value for the element. For type=textarea|input this value is the prefilled. For type=select this value is preselected.</li>
				<li><b>position</b> <br> The options will be sorted according to this numeric attribute. If omitted, the object will occur after the objects with a set position in the natural order of the keys.</li>
				<li><b>help</b> <i>(optional)</i><br> The help text which will be displayed while hovering over the information icon.</li>
				<li><b>type</b>
					<ul><li><b>input</b>: A standard input field (<i>default if omitted</i>)</li><li><b>textarea</b>: A textarea with a customizable number of rows (default: 5)</li><li><b>select</b>: A select element</li></ul>
				</li>
				<li><b>options</b> <i>(only applicable to type=select)</i><br>This field supports two different type of data: Array (of strings) and Object (value=&gt;Label).<br>
					If the data encountered is an Array, the elements are rendered as simple option elements. If it is an Object, the option elements will have the key of the object as their value and the value of the element will be displayed as the text.</li>
				<li><b>dynamicOptionsFunction</b> <i>(only applicable to type=select)</i><br>The body of a function which is used to populate the options array. The function receives a 'callback' parameter which has to be called with the resulting options.<br>The dynamic options can be in the same format as the options above. IMPORTANT: If this key is provided, the options key is ignored.</li>
				<li><b>rows</b> <i>(only applicable to type=textarea)</i><br>The number of rows the textarea will have initially. If omitted, or not parseable as an integer, it will default to 5.</li>
			</ul>

			<h2>Description</h2>
			<p>The description will be displayed when the user adds the widget to a page. It can contain HTML and usually serves the purpose of explaining what the widget is used for and the function of the configuration switches.</p>

			<h2>Options</h2>
			<p>The following options can be configured for a widget:</p>
			<ul>
				<li><b>Selectors</b><br>The selectors control into which elements a widget may be inserted. If a selector matches, the widget appears in the "Suggested widgets" context menu in the pages tree.</li>
				<li><b>Is Page Template</b><br>Check this box if the widget is a page template. The widget can the be selected when creating a page.</li>
			</ul>
		`,
		serversDialog: config => `
			<div id="widget-server-config-dialog" class="dialog-padding">

				<h3>Configured Servers</h3>
				<div id="widget-servers-container"></div>

				<h3 data-comment="Only use trusted sources for remote widgets!<br><br><strong>Using <em>untrusted sources</em> poses a security threat</strong>!" data-comment-config='{ "customToggleIcon": "warning-sign-icon-filled", "customToggleIconClasses": [], "helpElementCss": { "font-size": "14px"} }'>Add Server</h3>

				<div id="add-widget-server" class="grid items-center gap-x-2 gap-y-2" style="grid-template-columns: 1fr 10fr">

					<div class="bold">Name</div>
					<div><input id="new-widget-server-name"></div>

					<div class="bold">
						<label data-comment="The server should respond with JSON-formatted widgets as every structr instance would.<br><br>Because the widgets are fetched via a HTTP GET request, the usual rights management applies. Widgets need to be visible to public users to show up in the resulting list.">URL</label>
					</div>
					<div>
						<input id="new-widget-server-url">
					</div>

					<div></div>
					<div>
						<button id="save-widget-server" class="flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green">
							${_Icons.getSvgIcon('checkmark_bold', 14, 14, ['icon-green', 'mr-2'])} Save
						</button>
					</div>
				</div>
			</div>
		`,
		serversSelector: config => `
			<select id="widget-server-selector" class="w-40">
				${config.servers.map(s => {
					return `<option value="${s.content}" ${(s.content === config.selectedServerURL) ? 'selected' : ''}>${s.name}</option>`
				}).join('')}
			</select>
		`,
		serversTable: config => `
			<div class="grid items-center gap-x-2 gap-y-2" style="grid-template-columns: 20fr 70fr 10fr;">

				<div class="bold">Name</div>
				<div class="bold">URL</div>
				<div class="bold text-center">Actions</div>

				${config.servers.map((s) => {
					return `
						<div data-acdn-id="${s.id}">${s.editable !== false ? `<input data-key="name" value="${s.name}">` : `${s.name}`}</div>
						<div data-acdn-id="${s.id}">${s.editable !== false ? `<input data-key="content" value="${s.content}">` : `${s.content}`}</div>
						<div data-acdn-id="${s.id}" class="text-center">${s.editable !== false ? `${_Icons.getSvgIcon('trashcan', 16, 16, _Icons.getSvgIconClassesForColoredIcon(['mr-1', 'icon-red', 'delete']), 'Delete')}` : ''}</div>
					`;
				}).join('')}
			</div>
		`,
	}
};
