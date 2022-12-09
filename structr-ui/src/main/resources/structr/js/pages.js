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
$(document).ready(function() {
	Structr.registerModule(_Pages);
	Structr.classes.push('page');
});

let _Pages = {
	_moduleName: 'pages',
	autoRefresh: [],
	urlHashKey: 'structrUrlHashKey_' + location.port,
	activeTabRightKey: 'structrActiveTabRight_' + location.port,
	activeTabLeftKey: 'structrActiveTabLeft_' + location.port,
	leftTabMinWidth: 400,
	rightTabMinWidth: 400,
	selectedTypeKey: 'structrSelectedType_' + location.port,
	autoRefreshDisabledKey: 'structrAutoRefreshDisabled_' + location.port,
	detailsObjectIdKey: 'structrDetailsObjectId_' + location.port,
	requestParametersKey: 'structrRequestParameters_' + location.port,
	pagesResizerLeftKey: 'structrPagesResizerLeftKey_' + location.port,
	pagesResizerRightKey: 'structrPagesResizerRightKey_' + location.port,
	functionBarSwitchKey: 'structrFunctionBarSwitchKey_' + location.port,

	shadowPage: undefined,

	pagesSlideout: undefined,
	localizationsSlideout: undefined,

	widgetsSlideout: undefined,
	paletteSlideout: undefined,
	componentsSlideout: undefined,
	unusedElementsSlideout: undefined,

	components: undefined,
	unusedElementsTree: undefined,

	pagesTree: undefined,
	centerPane: undefined,

	textBeforeEditing: undefined,

	contentSourceId: undefined,

	init: function() {

		_Pager.initPager('pages',   'Page', 1, 25, 'name', 'asc');
		_Pager.initPager('files',   'File', 1, 25, 'name', 'asc');
		_Pager.initPager('folders', 'Folder', 1, 25, 'name', 'asc');
		_Pager.initPager('images',  'Image', 1, 25, 'name', 'asc');

		Structr.ensureShadowPageExists();
	},
	resize: function() {

		Structr.resize();

		$('body').css({
			position: 'fixed'
		});

		_Pages.resizeColumns();
	},
	dialogSizeChanged: () => {
		_Editors.resizeVisibleEditors();
	},
	onload: function() {

		let urlHash = LSWrapper.getItem(_Pages.urlHashKey);
		if (urlHash) {
			Structr.menuBlocked = false;
			window.location.hash = urlHash;
		}

		Structr.mainContainer.innerHTML = _Pages.templates.main();

		_Pages.init();

		Structr.updateMainHelpLink(Structr.getDocumentationURLForTopic('pages'));

		_Pages.pagesSlideout           = $('#pages');
		_Pages.localizationsSlideout   = $('#localizations');
		_Pages.pagesTree               = $('#pagesTree', _Pages.pagesSlideout);
		_Pages.centerPane              = document.querySelector('#center-pane');
		_Pages.previews.previewElement = document.querySelector('#previews');
		_Pages.widgetsSlideout         = $('#widgetsSlideout');
		_Pages.paletteSlideout         = $('#palette');
		_Pages.componentsSlideout      = $('#components');
		_Pages.unusedElementsSlideout  = $('#elements');
		_Pages.unusedElementsTree      = $('#elementsArea', _Pages.unusedElementsSlideout);

		let pagesTab = document.getElementById('pagesTab');
		let pagesTabSlideoutAction = (e) => {
			_Pages.leftSlideoutTrigger(pagesTab, _Pages.pagesSlideout, [_Pages.localizationsSlideout], (params) => {
				LSWrapper.setItem(_Pages.activeTabLeftKey, pagesTab.id);
				_Pages.resize();
				_Entities.highlightSelectedElementOnSlideoutOpen();
			}, _Pages.leftSlideoutClosedCallback);
		};

		pagesTab.addEventListener('click', pagesTabSlideoutAction);

		$(pagesTab).droppable({
			tolerance: 'touch',
			//over: pagesTabSlideoutAction
		});

		let localizationsTab = document.getElementById('localizationsTab');
		localizationsTab.addEventListener('click', () => {
			_Pages.leftSlideoutTrigger(localizationsTab, _Pages.localizationsSlideout, [_Pages.pagesSlideout], (params) => {
				LSWrapper.setItem(_Pages.activeTabLeftKey, localizationsTab.id);
				_Pages.localizations.refreshPagesForLocalizationPreview();
				_Pages.resize();
				_Entities.highlightSelectedElementOnSlideoutOpen();
			}, _Pages.leftSlideoutClosedCallback);
		});

		document.querySelector('#localizations input.locale').addEventListener('keydown', (e) => {
			if (e.which === 13) {
				_Pages.localizations.refreshLocalizations();
			}
		});

		let refreshLocalizationsButton = document.querySelector('#localizations button.refresh');
		refreshLocalizationsButton.addEventListener('click', () => {
			_Pages.localizations.refreshLocalizations();
		});

		Structr.appendInfoTextToElement({
			element: refreshLocalizationsButton,
			text: "On this tab you can load the localizations requested for the given locale on the currently previewed page (including the UUID of the details object and the query parameters which are also used for the preview).<br><br>The retrieval process works just as rendering the page. If you request the locale \"en_US\" you might get Localizations for \"en\" as a fallback if no exact match is found.<br><br>If no Localization could be found, an empty input field is rendered where you can quickly create the missing Localization.",
			insertAfter: true,
			helpElementCss: { width: "300px" },
			offsetX: -20,
			offsetY: 10
		});

		let widgetsTab = document.getElementById('widgetsTab');
		widgetsTab.addEventListener('click', () => {
			_Pages.rightSlideoutClickTrigger(widgetsTab, _Pages.widgetsSlideout, [_Pages.paletteSlideout, _Pages.componentsSlideout, _Pages.unusedElementsSlideout], (params) => {
				LSWrapper.setItem(_Pages.activeTabRightKey, widgetsTab.id);
				if (params.isOpenAction) {
					_Widgets.reloadWidgets();
				}
				_Pages.resize();
			}, _Pages.rightSlideoutClosedCallback);
		});

		let paletteTab = document.getElementById('paletteTab');
		paletteTab.addEventListener('click', () => {
			_Pages.rightSlideoutClickTrigger(paletteTab, _Pages.paletteSlideout, [_Pages.widgetsSlideout, _Pages.componentsSlideout, _Pages.unusedElementsSlideout], (params) => {
				LSWrapper.setItem(_Pages.activeTabRightKey, paletteTab.id);
				if (params.isOpenAction) {
					_Pages.designTools.reload();
				}
				_Pages.resize();
			}, _Pages.rightSlideoutClosedCallback);
		});

		let componentsTab = document.getElementById('componentsTab');
		let componentsTabSlideoutAction = () => {
			_Pages.rightSlideoutClickTrigger(componentsTab, _Pages.componentsSlideout, [_Pages.widgetsSlideout, _Pages.paletteSlideout, _Pages.unusedElementsSlideout], (params) => {
				LSWrapper.setItem(_Pages.activeTabRightKey, componentsTab.id);
				if (params.isOpenAction) {
					_Pages.sharedComponents.reload();
				}
				_Pages.resize();
			}, _Pages.rightSlideoutClosedCallback);
		};
		componentsTab.addEventListener('click', componentsTabSlideoutAction);

		$(componentsTab).droppable({
			tolerance: 'touch',
			over: (e, ui) => {

				let isComponentsSlideoutOpen = _Pages.componentsSlideout.hasClass('open');
				let isColumnResizer          = $(ui.draggable).hasClass('column-resizer');

				if (!isComponentsSlideoutOpen && !isColumnResizer) {
					componentsTabSlideoutAction();
				}
			}
		});

		let elementsTab = document.getElementById('elementsTab');
		elementsTab.addEventListener('click', () => {
			_Pages.rightSlideoutClickTrigger(elementsTab, _Pages.unusedElementsSlideout, [_Pages.widgetsSlideout, _Pages.paletteSlideout, _Pages.componentsSlideout], (params) => {
				LSWrapper.setItem(_Pages.activeTabRightKey, elementsTab.id);
				if (params.isOpenAction) {
					_Pages.unattachedNodes.reload();
				}
				_Pages.resize();
			}, (wasOpen) => {
				_Pages.unattachedNodes.removeElementsFromUI();
				_Pages.rightSlideoutClosedCallback(wasOpen);
			});
		});

		_Pages.refresh();
	},
	getContextMenuElements: (div, entity) => {

		const isPage             = (entity.type === 'Page');
		const isContent          = (entity.type === 'Content');
		const hasChildren        = (entity.children && entity.children.length > 0);

		let handleInsertHTMLAction = (itemText) => {
			let pageId = isPage ? entity.id : entity.pageId;
			let tagName = itemText;

			Command.createAndAppendDOMNode(pageId, entity.id, tagName, _Dragndrop.getAdditionalDataForElementCreation(tagName, entity.tag), _Elements.isInheritVisibilityFlagsChecked(), _Elements.isInheritGranteesChecked());
		};

		let handleInsertBeforeAction = (itemText) => { Command.createAndInsertRelativeToDOMNode(entity.pageId, entity.id, itemText, _Dragndrop.getAdditionalDataForElementCreation(itemText, entity.tag), 'Before', _Elements.isInheritVisibilityFlagsChecked(), _Elements.isInheritGranteesChecked()); };
		let handleInsertAfterAction  = (itemText) => { Command.createAndInsertRelativeToDOMNode(entity.pageId, entity.id, itemText, _Dragndrop.getAdditionalDataForElementCreation(itemText, entity.tag), 'After', _Elements.isInheritVisibilityFlagsChecked(), _Elements.isInheritGranteesChecked()); };
		let handleWrapInHTMLAction   = (itemText) => {

			_Dragndrop.storeTemporarilyRemovedElementUUID(entity.id);

			Command.wrapDOMNodeInNewDOMNode(entity.pageId, entity.id, itemText, {}, _Elements.isInheritVisibilityFlagsChecked(), _Elements.isInheritGranteesChecked());

			_Dragndrop.clearTemporarilyRemovedElementUUID();
		};

		let elements = [];

		if (!isContent) {

			elements.push({
				name: 'Insert HTML element',
				elements: !isPage ? _Elements.sortedElementGroups : ['html'],
				forcedClickHandler: handleInsertHTMLAction
			});

			elements.push({
				name: 'Insert content element',
				elements: !isPage ? ['#content', '#template'] : ['#template'],
				forcedClickHandler: handleInsertHTMLAction
			});

			if (_Elements.suggestedElements[entity.tag]) {
				elements.push({
					name: 'Suggested HTML element',
					elements: _Elements.suggestedElements[entity.tag],
					forcedClickHandler: handleInsertHTMLAction
				});
			}
		}

		if (!isPage && !isContent) {
			elements.push({
				name: 'Insert div element',
				clickHandler: function () {
					Command.createAndAppendDOMNode(entity.pageId, entity.id, 'div', _Dragndrop.getAdditionalDataForElementCreation('div'), _Elements.isInheritVisibilityFlagsChecked(), _Elements.isInheritGranteesChecked());
					return false;
				}
			});
		}

		_Elements.appendContextMenuSeparator(elements);

		if (!isPage && entity.parent !== null && (entity.parent && entity.parent.type !== 'Page')) {

			elements.push({
				name: 'Insert before...',
				elements: [
					{
						name: '... HTML element',
						elements: _Elements.sortedElementGroups,
						forcedClickHandler: handleInsertBeforeAction
					},
					{
						name: '... Content element',
						elements: ['#content', '#template'],
						forcedClickHandler: handleInsertBeforeAction
					},
					{
						name: '... div element',
						clickHandler: function () {
							handleInsertBeforeAction('div');
						}
					}
				]
			});

			elements.push({
				name: 'Insert after...',
				elements: [
					{
						name: '... HTML element',
						elements: _Elements.sortedElementGroups,
						forcedClickHandler: handleInsertAfterAction
					},
					{
						name: '... Content element',
						elements: ['#content', '#template'],
						forcedClickHandler: handleInsertAfterAction
					},
					{
						name: '... div element',
						clickHandler: function () {
							handleInsertAfterAction('div');
						}
					}
				]
			});

			_Elements.appendContextMenuSeparator(elements);
		}

		if (entity.type === 'Div' && !hasChildren) {

			elements.push({
				icon: _Icons.getSvgIcon('pencil_edit'),
				name: 'Edit',
				clickHandler: () => {
					_Entities.editEmptyDiv(entity);
					return false;
				}
			});
		}

		let hasParentAndParentIsNotPage = (entity.parent && entity.parent.type !== 'Page');
		let parentIsShadowPage          = (entity.parent === null && entity.pageId === _Pages.shadowPage.id);

		if (!isPage && hasParentAndParentIsNotPage || parentIsShadowPage) {

			elements.push({
				icon: _Icons.getSvgIcon('duplicate'),
				name: 'Clone',
				clickHandler: function () {
					Command.cloneNode(entity.id, (entity.parent ? entity.parent.id : null), true);
					return false;
				}
			});

			_Elements.appendContextMenuSeparator(elements);
		}

		if (!isPage && hasParentAndParentIsNotPage) {

			_Elements.appendContextMenuSeparator(elements);

			elements.push({
				name: 'Wrap element in...',
				elements: [
					{
						name: '... HTML element',
						elements: _Elements.sortedElementGroups,
						forcedClickHandler: handleWrapInHTMLAction
					},
					{
						name: '... Template element',
						clickHandler: function () {
							handleWrapInHTMLAction('#template');
						}
					},
					{
						name: '... div element',
						clickHandler: function () {
							handleWrapInHTMLAction('div');
						}
					}
				]
			});
		}

		if (isPage) {
			elements.push({
				icon: _Icons.getSvgIcon('duplicate'),
				name: 'Clone Page',
				clickHandler: function () {
					Command.clonePage(entity.id);
					return false;
				}
			});
		}

		if (!isPage) {

			_Elements.appendContextMenuSeparator(elements);

			if (_Elements.selectedEntity && _Elements.selectedEntity.id === entity.id) {
				elements.push({
					name: 'Deselect element',
					clickHandler: function () {
						_Elements.unselectEntity();
						return false;
					}
				});
			} else {
				elements.push({
					name: 'Select element',
					clickHandler: function () {
						_Elements.selectEntity(entity);
						return false;
					}
				});
			}

			let canConvertToSharedComponent = !entity.sharedComponentId && !entity.isPage && (entity.pageId !== _Pages.shadowPage.id || entity.parent !== null );
			if (canConvertToSharedComponent) {
				_Elements.appendContextMenuSeparator(elements);

				elements.push({
					name: 'Convert to Shared Component',
					clickHandler: function () {
						Command.createComponent(entity.id);
						return false;
					}
				});
			}
		}

		if (!isContent && _Elements.selectedEntity && _Elements.selectedEntity.id !== entity.id) {

			let isSamePage = _Elements.selectedEntity.pageId === entity.pageId;
			let isThisEntityDirectParentOfSelectedEntity = (_Elements.selectedEntity.parent && _Elements.selectedEntity.parent.id === entity.id);
			let isSelectedEntityInShadowPage = _Elements.selectedEntity.pageId === _Pages.shadowPage.id;
			let isSelectedEntitySharedComponent = isSelectedEntityInShadowPage && !_Elements.selectedEntity.parent;

			let isDescendantOfSelectedEntity = function (possibleDescendant) {
				if (possibleDescendant.parent) {
					if (possibleDescendant.parent.id === _Elements.selectedEntity.id) {
						return true;
					}
					return isDescendantOfSelectedEntity(StructrModel.obj(possibleDescendant.parent.id));
				}
				return false;
			};

			if (isSelectedEntitySharedComponent) {
				elements.push({
					name: 'Link shared component here',
					clickHandler: function () {
						Command.cloneComponent(_Elements.selectedEntity.id, entity.id);
						_Elements.unselectEntity();
						return false;
					}
				});

			}

			if (!isPage || (isPage && !hasChildren && (_Elements.selectedEntity.tag === 'html' || _Elements.selectedEntity.type === 'Template'))) {
				elements.push({
					name: 'Clone selected element here',
					clickHandler: function () {
						Command.cloneNode(_Elements.selectedEntity.id, entity.id, true);
						_Elements.unselectEntity();
						return false;
					}
				});
			}

			if (isSamePage && !isThisEntityDirectParentOfSelectedEntity && !isSelectedEntityInShadowPage && !isDescendantOfSelectedEntity(entity)) {
				elements.push({
					name: 'Move selected element here',
					clickHandler: function () {
						Command.appendChild(_Elements.selectedEntity.id, entity.id, entity.pageId);
						_Elements.unselectEntity();
						return false;
					}
				});
			}
		}

		_Elements.appendContextMenuSeparator(elements);

		if (!isContent && hasChildren) {

			elements.push({
				name: 'Expand / Collapse',
				elements: [
					{
						name: 'Expand subtree',
						clickHandler: function() {
							$(div).find('.node').each(function(i, el) {
								if (!_Entities.isExpanded(el)) {
									_Entities.toggleElement(entity.id, el);
								}
							});
							if (!_Entities.isExpanded(div)) {
								_Entities.toggleElement(entity.id, div);
							}
							return false;
						}
					},
					{
						name: 'Expand subtree recursively',
						clickHandler: function() {
							_Entities.expandRecursively([entity.id]);
							return false;
						}
					},
					{
						name: 'Collapse subtree',
						clickHandler: function() {
							$(div).find('.node').each(function(i, el) {
								if (_Entities.isExpanded(el)) {
									_Entities.toggleElement(entity.id, el);
								}
							});
							if (_Entities.isExpanded(div)) {
								_Entities.toggleElement(entity.id, div);
							}
							return false;
						}
					}
				]
			});
		}

		_Elements.appendContextMenuSeparator(elements);

		// DELETE AREA - ALWAYS AT THE BOTTOM
		// allow "Remove Node" on first level children of page
		if (!isPage && entity.parent !== null) {

			elements.push({
				icon: _Icons.getSvgIcon('trashcan'),
				classes: ['menu-bolder', 'danger'],
				name: 'Remove Node',
				clickHandler: function () {
					Command.removeChild(entity.id, () => {
						_Pages.unattachedNodes.blinkUI();
					});
					return false;
				}
			});
		}

		// should only be visible for type===Page
		if (isPage || !entity.parent) {

			elements.push({
				icon: _Icons.getSvgIcon('trashcan'),
				classes: ['menu-bolder', 'danger'],
				name: 'Delete ' + entity.type,
				clickHandler: () => {

					if (isContent) {

						_Entities.deleteNode(undefined, entity);

					} else {

						_Entities.deleteNode(undefined, entity, true, () => {

							if (entity.syncedNodesIds && entity.syncedNodesIds.length) {

								for (let id of entity.syncedNodesIds) {

									let el = Structr.nodeContainer(id);
									if (el) {
										_Icons.updateSpriteClassTo(el.children('i.typeIcon')[0], _Icons.getSpriteClassOnly(_Icons.brick_icon));
									}
								}
							}
						});
					}
					return false;
				}
			});
		}

		_Elements.appendContextMenuSeparator(elements);

		return elements;
	},
	prevAnimFrameReqId_moveLeftResizer: undefined,
	moveLeftResizer: (left) => {
		Structr.requestAnimationFrameWrapper(_Pages.prevAnimFrameReqId_moveLeftResizer, () => {
			_Pages.resizeColumns(left, null);
		});
	},
	prevAnimFrameReqId_moveRightResizer: undefined,
	moveRightResizer: (right) => {
		Structr.requestAnimationFrameWrapper(_Pages.prevAnimFrameReqId_moveRightResizer, () => {
			_Pages.resizeColumns(null, right);
		});
	},
	resizeColumns: function(pxLeft, pxRight) {

		if (!pxLeft && !pxRight) {
			pxLeft  = LSWrapper.getItem(_Pages.pagesResizerLeftKey)  || _Pages.leftTabMinWidth;
			pxRight = LSWrapper.getItem(_Pages.pagesResizerRightKey) || _Pages.rightTabMinWidth;
		}

		let leftResizer       = document.querySelector('.column-resizer-left');
		let openLeftSlideout  = document.querySelector('.slideOutLeft.open');
		let rightResizer      = document.querySelector('.column-resizer-right');
		let openRightSlideout = document.querySelector('.slideOutRight.open');

		if (!openLeftSlideout) {
			pxLeft = 0;
		}
		if (!openRightSlideout) {
			pxRight = 0;
		}

		let leftPos  = pxLeft  ? pxLeft  : (openLeftSlideout  ? openLeftSlideout.getBoundingClientRect().right  : 0);
		let rightPos = pxRight ? pxRight : (openRightSlideout ? openRightSlideout.getBoundingClientRect().width : 0);

		let tabsMenu = document.querySelector('#function-bar .tabs-menu');

		if (leftResizer) {

			if (pxLeft) {

				leftResizer.style.left = 'calc(' + leftPos + 'px + 0rem)';

				if (openLeftSlideout) openLeftSlideout.style.width = 'calc(' + leftPos + 'px - 3rem)';

				_Pages.centerPane.style.marginLeft = 'calc(' + leftPos + 'px + 3rem)';

				if (tabsMenu) tabsMenu.style.marginLeft = 'calc(' + leftPos + 'px + 2rem)';

			} else {

				if (leftPos === 0) {

					if (tabsMenu) tabsMenu.style.marginLeft = 'calc(' + leftPos + 'px + 2rem)';

					let columnResizerLeft = '4rem';
					leftResizer.style.left = columnResizerLeft;
					_Pages.centerPane.style.marginLeft = columnResizerLeft;

				} else {

					if (tabsMenu) tabsMenu.style.marginLeft = 'calc(' + leftPos + 'px + 0rem)';

					leftResizer.style.left = 'calc(' + leftPos + 'px - 1rem)';
					_Pages.centerPane.style.marginLeft = 'calc(' + leftPos + 'px + 2rem)';
				}
			}
		}

		if (rightResizer) {

			if (pxRight) {

				rightResizer.style.left = 'calc(' + (window.innerWidth - rightPos) + 'px + 0rem)';

				if (openRightSlideout) openRightSlideout.style.width = 'calc(' + rightPos + 'px - 7rem)';

				_Pages.centerPane.style.marginRight = 'calc(' + rightPos + 'px - 1rem)';

			} else {

				if (rightPos === 0) {

					let columnResizerRight = '4rem';
					rightResizer.style.left = columnResizerRight;
					_Pages.centerPane.style.marginRight = columnResizerRight;

				} else {

					rightResizer.style.left = 'calc(' + (window.innerWidth - rightPos) + 'px - 3rem)';
					_Pages.centerPane.style.marginRight = 'calc(' + (rightPos) + 'px + 2rem)';
				}
			}
		}

		_Editors.resizeVisibleEditors();
	},
	refresh: () => {

		fastRemoveAllChildren(_Pages.pagesTree[0]);

		Structr.functionBar.innerHTML = _Pages.templates.functions();

		UISettings.showSettingsForCurrentModule();

		_Pages.resize();

		$(window).off('resize').resize(function () {
			_Pages.resize();
		});

		Structr.initVerticalSlider(Structr.mainContainer.querySelector('.column-resizer-left'), _Pages.pagesResizerLeftKey, _Pages.leftTabMinWidth, _Pages.moveLeftResizer);
		Structr.initVerticalSlider(Structr.mainContainer.querySelector('.column-resizer-right'), _Pages.pagesResizerRightKey, _Pages.rightTabMinWidth, _Pages.moveRightResizer, true);

		Structr.unblockMenu(500);

		document.getElementById(_Pages.getActiveTabLeft())?.click();
		document.getElementById(_Pages.getActiveTabRight())?.click();

		_Pages.adaptFunctionBarTabs();

		for (const menuLink of document.querySelectorAll('#function-bar .tabs-menu li a')) {
			menuLink.onclick = (event) => _Pages.activateCenterPane(menuLink);
		}

		let pagesPager = $('#pagesPager');
		let pPager     = _Pager.addPager('pages', pagesPager, true, 'Page', null, null, null, null, true, true);

		pPager.cleanupFunction = () => {
			fastRemoveAllChildren(_Pages.pagesTree[0]);
		};

		let filerEl = $('#pagesPagerFilters');
		pPager.activateFilterElements(filerEl);
		pPager.setIsPaused(false);
		pPager.refresh();

		fetch(Structr.rootUrl + 'Page/category').then((response) => {
			if (response.ok) {
				return response.json();
			}
		}).then((data) => {

			let categories = [];
			for (let page of data.result) {
				if (page.category !== null && categories.indexOf(page.category) === -1) {
					categories.push(page.category);
				}
			}
			categories.sort();

			let helpText = 'Filter pages by page category.';
			if (categories.length > 0) {
				helpText += 'Available categories: \n\n' + categories.join('\n');
			}

			$('input.category-filter', filerEl).attr('title', helpText);
		});

		/*
		var bulkEditingHelper = $(
			'<button type="button" title="Open Bulk Editing Helper (Ctrl-Alt-E)" class="icon-button">'
			+ '<i class="icon ' + _Icons.getFullSpriteClass(_Icons.wand_icon) + '" />'
			+ '</button>');
		pPager.appendFilterElements(bulkEditingHelper);
		bulkEditingHelper.on('click', e => {
			Structr.dialog('Bulk Editing Helper (Ctrl-Alt-E)');
			new RefactoringHelper(dialog).show();
		});
		*/

		$('#import_page').on('click', (e) => {
			e.stopPropagation();

			Structr.dialog('Import Template', function() {}, function() {});

			dialog.empty();
			dialogMsg.empty();

			dialog.append(`
				<h3>Create page from source code ...</h3>
				<textarea id="_code" name="code" cols="40" rows="5" placeholder="Paste HTML code here"></textarea>

				<h3>... or fetch page from URL: <input id="_address" name="address" size="40" value="http://"></h3>
				<table class="props">
					<tr>
						<td><label for="name">Name of new page:</label></td>
						<td><input id="_name" name="name" size="20"></td></tr>
					<tr>
						<td><label for="publicVisibilty">Visible to public</label></td>
						<td><input type="checkbox" id="_publicVisible" name="publicVisibility"></td></tr>
					<tr>
						<td><label for="authVisibilty">Visible to authenticated users</label></td>
						<td><input type="checkbox" id="_authVisible" name="authVisibilty"></td></tr>
					<tr>
						<td><label for="includeInExport">Include imported files in deployment export</label></td>
						<td><input type="checkbox" id="_includeInExport" name="includeInExport" checked="checked"></td></tr>
					<tr>
						<td><label for="processDeploymentInfo">Process deployment annotations</label></td>
						<td><input type="checkbox" id="_processDeploymentInfo" name="processDeploymentInfo"></td></tr>
				</table>
			`);

			$('#_address', dialog).on('blur', function() {
				let addr = $(this).val().replace(/\/+$/, "");
				$('#_name', dialog).val(addr.substring(addr.lastIndexOf("/") + 1));
			});

			dialog.append('<button class="action" id="startImport">Start Import</button>');

			$('#startImport').on('click', function(e) {
				e.stopPropagation();

				let code                  = $('#_code', dialog).val();
				let address               = $('#_address', dialog).val();
				let name                  = $('#_name', dialog).val();
				let publicVisible         = $('#_publicVisible', dialog).prop('checked');
				let authVisible           = $('#_authVisible', dialog).prop('checked');
				let includeInExport       = $('#_includeInExport', dialog).prop('checked');
				let processDeploymentInfo = $('#_processDeploymentInfo', dialog).prop('checked');

				if (code.length > 0) {
					address = null;
				}

				return Command.importPage(code, address, name, publicVisible, authVisible, includeInExport, processDeploymentInfo);
			});
		});

		// Display 'Create Page' dialog
		let createPageButton = document.querySelector('#create_page');
		createPageButton.addEventListener('click', async (e) => {

			e.stopPropagation();

			let pageTemplates = await _Widgets.fetchAllPageTemplateWidgets();

			if (pageTemplates.length === 0) {

				Command.createSimplePage();
				blinkGreen(createPageButton);

			} else {

				Structr.dialog('Select Template to Create New Page', () => {}, () => {});

				dialog.empty();
				dialogMsg.empty();
				let dialogDom = Structr.createSingleDOMElementFromHTML('<div id="template-tiles"></div>');
				dialog.append(dialogDom);

				let container = $('#template-tiles');

				for (let widget of pageTemplates) {

					let id = 'create-from-' + widget.id;
					let tile = Structr.createSingleDOMElementFromHTML(`<div id="${id}" class="app-tile"><img src="${widget.thumbnailPath}"/><h4>${widget.name}</h4><p>${(widget.description || '')}</p></div>`);
					container.append(tile);

					//let createPageButton = dom.querySelector('#' + id);
					tile.addEventListener('click', () => {
						Command.create({ type: 'Page' }, (page) => {
							Structr.removeExpandedNode(page.id);
							Command.appendWidget(widget.source, page.id, page.id, null, {}, true);

							blinkGreen(tile);
						});
					});

				}

				// default page
				let defaultTile = Structr.createSingleDOMElementFromHTML('<div id="create-simple-page" class="app-tile"><img src="https://apps.structr.com/assets/images/empty.png"/><h4>Simple Page</h4><p>Creates a simple page with a minimum set of HTML elements</p></div>');
				container.append(defaultTile);

				let createSimplePageButton = dialogDom.querySelector('#create-simple-page');
				createSimplePageButton.addEventListener('click', () => {
					Command.createSimplePage();
					blinkGreen(createSimplePageButton);
				});
			}
		});

		Structr.adaptUiToAvailableFeatures();

		let selectedObjectId = LSWrapper.getItem(_Entities.selectedObjectIdKey);
		if (selectedObjectId) {

			fetch(Structr.rootUrl + selectedObjectId).then(response => {
				if (!response.ok) {
					// looks like element was deleted
					LSWrapper.removeItem(_Entities.selectedObjectIdKey);
				}
			});
		}
	},
	removePage: (page) => {

		Structr.removeExpandedNode(page.id);
	},
	deactivateAllFunctionBarTabs: () => {
		for (const otherTab of document.querySelectorAll('#function-bar .tabs-menu li.active')) {
			otherTab.classList.remove('active');
		}
	},
	hideAllFunctionBarTabs: () => {
		for (const otherTab of document.querySelectorAll('#function-bar .tabs-menu li')) {
			otherTab.classList.add('hidden');
		}
	},
	selectedObjectWasDeleted: () => {
		_Pages.emptyCenterPane();
		_Pages.adaptFunctionBarTabs();
	},
	showTabsMenu: () => {
		let tabsMenu = document.querySelector('#function-bar .tabs-menu');
		if (tabsMenu) {
			tabsMenu.style.display = 'inline-block';
		}
	},
	adaptFunctionBarTabs: (entity) => {

		if (entity) {

			_Pages.showTabsMenu();

			// first show everything - later hide some
			for (let li of document.querySelectorAll('.tabs-menu li.hidden')) {
				li.classList.remove('hidden');
			}

			switch (entity.type) {
				case 'Page':
					document.querySelector('a[href="#pages:html"]').closest('li').classList.add('hidden');
					document.querySelector('a[href="#pages:editor"]').closest('li').classList.add('hidden');
					document.querySelector('a[href="#pages:repeater"]').closest('li').classList.add('hidden');
					document.querySelector('a[href="#pages:events"]').closest('li').classList.add('hidden');
					break;

				default:

					if (entity.isContent) {
						document.querySelector('a[href="#pages:html"]').closest('li').classList.add('hidden');
						document.querySelector('a[href="#pages:editor"]').closest('li').classList.remove('hidden');
						document.querySelector('a[href="#pages:events"]').closest('li').classList.add('hidden');
					} else {
						document.querySelector('a[href="#pages:html"]').closest('li').classList.remove('hidden');
						document.querySelector('a[href="#pages:editor"]').closest('li').classList.add('hidden');
						document.querySelector('a[href="#pages:repeater"]').closest('li').classList.remove('hidden');
						document.querySelector('a[href="#pages:events"]').closest('li').classList.remove('hidden');
					}
			}

			if (!_Entities.isLinkableEntity(entity)) {
				document.querySelector('a[href="#pages:link"]').closest('li').classList.add('hidden');
			}

			// Create shadow page if not existing
			Structr.ensureShadowPageExists().then(() => {
				let isEntityInSharedComponents = (entity.pageId === _Pages.shadowPage.id);
				let isEntityInTrash = (!entity.isPage && !entity.pageId);
				if (isEntityInSharedComponents || isEntityInTrash) {
					document.querySelector('a[href="#pages:preview"]').closest('li').classList.add('hidden');
				}
			});

		} else {
			_Pages.hideAllFunctionBarTabs();
		}
	},
	activateSubmenuTabElement: (tab) => {
		_Pages.deactivateAllFunctionBarTabs();

		tab.classList.add('active');
	},
	activateSubmenuLink: (selector) => {
		let submenuLink = document.querySelector('#function-bar .tabs-menu li a[href="' + selector + '"]');
		if (submenuLink) {
			let tab = submenuLink.closest('li');
			_Pages.activateSubmenuTabElement(tab);
		}
	},
	activateCenterPane: (link) => {
		let tab    = link.closest('li');
		let active = tab.classList.contains('active');

		// return if clicked tab already is active
		if (active) return;

		_Pages.activateSubmenuTabElement(tab);

		let obj = _Entities.selectedObject;
		if (!obj || !obj.type) return;

		active = tab.classList.contains('active');

		_Pages.refreshCenterPane(obj, new URL(link.href).hash);
	},
	emptyCenterPane: () => {
		fastRemoveAllChildren(_Pages.centerPane);
	},
	refreshCenterPane: (obj, urlHash) => {

		_Entities.deselectAllElements();

		_Pages.centerPane.dataset['elementId'] = obj.id;

		if (UISettings.getValueForSetting(UISettings.pages.settings.favorEditorForContentElementsKey) && (!urlHash && obj.isContent)) {
			/*
				if urlHash is given, user has manually selected a tab. if it is not given, user has selected a node
			*/
			urlHash = '#pages:editor';
		}

		if (UISettings.getValueForSetting(UISettings.pages.settings.favorHTMLForDOMNodesKey) && (!urlHash && obj.isDOMNode)) {
			/*
				if urlHash is given, user has manually selected a tab. if it is not given, user has selected a node
			*/
			urlHash = '#pages:html';
		}

		let contentContainers = _Pages.centerPane.querySelectorAll('.content-container');

		for (const contentContainer of contentContainers) {
			_Pages.centerPane.removeChild(contentContainer);
		}

		_Pages.adaptFunctionBarTabs(obj);

		if (!urlHash) {
			urlHash = new URL(location.href).hash;
		}
		let activeLink = document.querySelector('#function-bar .tabs-menu li a[href="' + urlHash + '"]');


		if (activeLink) {

			if (activeLink.closest('li').classList.contains('hidden')) {
				_Entities.deselectAllElements();
				activeLink = document.querySelector('#function-bar .tabs-menu li a');

				_Pages.activateSubmenuTabElement(activeLink.closest('li'));
			}

			urlHash = new URL(activeLink.href).hash;
			LSWrapper.setItem(_Pages.urlHashKey, urlHash);

		} else {

			urlHash = LSWrapper.getItem(_Pages.urlHashKey);
			if (!urlHash) {
				urlHash = new URL(window.location.href).hash;
			}
			// Activate submenu link
			activeLink = document.querySelector('#function-bar .tabs-menu li a[href="' + urlHash + '"]');

			if (activeLink) {
				if (activeLink.closest('li').classList.contains('hidden')) {
					activeLink = document.querySelector('#function-bar .tabs-menu li a');
				}

			} else {
				// activate first link
				activeLink = document.querySelector('#function-bar .tabs-menu li a');

				// TODO: or maybe better default tab for element? Page--> Preview, Content --> Editor
			}

			urlHash = new URL(activeLink.href).hash;
		}

		_Pages.activateSubmenuTabElement(activeLink.closest('li'));

		// Set default views based on object type
		if (urlHash === '#pages') {
			switch (obj.type) {
				case 'Page':
					urlHash = '#pages:preview';
					break;
				case 'Template':
				case 'Content':
					urlHash = '#pages:editor';
				default:
					urlHash = '#pages:basic';
			}
		}

		switch (urlHash) {

			case '#pages:basic':

				let dialogConfig = _Dialogs.getDialogConfigForEntity(obj);

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.basic());
				let basicContainer = document.querySelector('#center-pane .basic-container');

				if (dialogConfig) {
					dialogConfig.appendDialogForEntityToContainer($(basicContainer), obj);
				}

				break;

			case '#pages:html': {

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.properties());
				let propertiesContainer = document.querySelector('#center-pane .properties-container');

				_Schema.getTypeInfo(obj.type, function(typeInfo) {

					_Entities.listProperties(obj, '_html_', $(propertiesContainer), typeInfo, function(properties) {

						// make container visible when custom properties exist
						if (Object.keys(properties).length > 0) {
							$('div#custom-properties-parent').removeClass("hidden");
						}

						$('input.dateField', $(propertiesContainer)).each(function(i, input) {
							_Entities.activateDatePicker($(input));
						});
					});
				});
				break;
			}

			case '#pages:advanced': {

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.properties());
				let propertiesContainer = document.querySelector('#center-pane .properties-container');

				_Schema.getTypeInfo(obj.type, function(typeInfo) {

					_Entities.listProperties(obj, 'ui', $(propertiesContainer), typeInfo, function(properties) {

						// make container visible when custom properties exist
						if (Object.keys(properties).length > 0) {
							$('div#custom-properties-parent').removeClass("hidden");
						}

						$('input.dateField', $(propertiesContainer)).each(function(i, input) {
							_Entities.activateDatePicker($(input));
						});
					});
				});
				break;
			}

			case '#pages:preview':

				let pageId = null;

				if (obj.type === 'Page') {

					pageId = obj.id;

				} else if (obj.isDOMNode) {

					pageId = obj.pageId;
				}

				_Pages.previews.showPreviewInIframe(pageId, obj.id);

				break;

			case '#pages:editor':

				if (obj.isContent) {
					_Elements.displayCentralEditor(obj);
				} else {
					document.querySelector('[href="#pages:advanced"]').click();
				}
				break;

			case '#pages:repeater':

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.repeater());
				let repeaterContainer = document.querySelector('#center-pane .repeater-container');
				_Entities.repeaterConfig(obj, repeaterContainer);
				break;

			case '#pages:events':

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.events());
				let eventsContainer = document.querySelector('#center-pane .events-container');

				_Schema.getTypeInfo(obj.type, (typeInfo) => {
					_Entities.dataBindingDialog(obj, $(eventsContainer), typeInfo);
				});
				break;

			case '#pages:security':

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.security());
				let securityContainer = document.querySelector('#center-pane .security-container');

				_Schema.getTypeInfo(obj.type, (typeInfo) => {
					_Entities.accessControlDialog(obj, $(securityContainer), typeInfo);
				});
				break;

			case '#pages:link':

				_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.linkable());
				_Pages.linkableDialog.show(obj, _Pages.centerPane.querySelector('.linkable-container'));
				break;

			default:
				console.log('do something else, urlHash:', urlHash);
		}
	},
	appendPageElement: (entity) => {

		entity = StructrModel.ensureObject(entity);

		let hasChildren = entity.children && entity.children.length;

		if (!_Pages.pagesTree) return;

		if ($('#id_' + entity.id, _Pages.pagesTree).length > 0) {
			return;
		}
		let pageName = (entity.name ? entity.name : '[' + entity.type + ']');

		_Pages.pagesTree.append(`
			<div id="id_${entity.id}" class="node page${entity.hidden ? ' is-hidden' : ''}">
				<div class="node-container flex items-center">
					<div class="node-selector"></div>
					${_Icons.getSvgIcon('browser-page', 16, 16, 'typeIcon')}
					<span class="abbr-ellipsis abbr-pages-tree-page">
						<b title="${escapeForHtmlAttributes(entity.name)}" class="name_">${pageName}</b>
						${(entity.position ? ` <span class="position_">${entity.position}</span>` : '')}
					</span>
					<div class="icons-container flex items-center"></div>
				</div>
			</div>
		`);

		let div            = Structr.node(entity.id);
		let nodeContainer  = $('.node-container', div);
		let iconsContainer = $('.icons-container', div);

		_Dragndrop.makeSortable(div);

		$('.button', div).on('mousedown', function(e) {
			e.stopPropagation();
		});

		_Entities.appendExpandIcon(nodeContainer, entity, hasChildren);

		_Entities.appendContextMenuIcon(iconsContainer, entity);
		_Pages.appendPagePreviewIcon(iconsContainer, entity);
		_Entities.appendNewAccessControlIcon(iconsContainer, entity);

		_Elements.enableContextMenuOnElement(div, entity);
		_Entities.setMouseOver(div);

		_Dragndrop.makeDroppable(div);

		_Elements.clickOrSelectElementIfLastSelected(div, entity);

		return div;
	},
	appendPagePreviewIcon: (parent, page) => {

		let pagePreviewIconClass = 'svg_page_preview_icon';
		let icon = $('.' + pagePreviewIconClass, parent);

		if (!(icon && icon.length)) {

			icon = $(_Icons.getSvgIcon('link_external', 16, 16, _Icons.getSvgIconClassesNonColorIcon([pagePreviewIconClass, 'node-action-icon', 'mr-1'])));
			parent.append(icon);

			icon.on('click', (e) => {
				e.stopPropagation();
				_Pages.openPagePreviewInNewWindow(page);
			});
		}

		return icon;
	},
	openPagePreviewInNewWindow: (entity) => {

		let url = _Pages.previews.getUrlForPage(entity);
		window.open(url);
	},
	registerDetailClickHandler: (element, entity) => {

		if (Structr.getActiveModule() === _Pages && element.data('clickhandlerSet') !== true) {

			element.data('clickhandlerSet', true);

			element.on('click', function(e) {

				let clickedObjectIsCurrentlySelected = _Entities.selectedObject && _Entities.selectedObject.id === entity.id;
				let isElementBeingEditedCurrently    = (_Pages.centerPane.dataset['elementId'] === entity.id);

				_Entities.selectElement(element.closest('.node')[0], entity);

				if (!clickedObjectIsCurrentlySelected || !isElementBeingEditedCurrently) {

					LSWrapper.setItem(_Entities.selectedObjectIdKey, entity.id);
					_Pages.refreshCenterPane(entity);
				}
			});
		}
	},
	saveInlineElement: (el, callback) => {
		let self = $(el);
		_Pages.contentSourceId = self.attr('data-structr-id');
		let text = unescapeTags(cleanText(self.html()));
		self.attr('contenteditable', false);
		self.removeClass('structr-editable-area-active').removeClass('structr-editable-area');

		Command.setProperty(_Pages.contentSourceId, 'content', text, false, (obj) => {
			if (_Pages.contentSourceId === obj.id) {
				if (callback) {
					callback();
				}
				_Pages.contentSourceId = null;
			}
		});
	},
	appendElementElement: (entity, refNode, refNodeIsParent) => {

		entity  = StructrModel.ensureObject(entity);
		let div = _Elements.appendElementElement(entity, refNode, refNodeIsParent);

		if (!div) {
			return false;
		}

		_Dragndrop.makeDroppable(div);
		_Dragndrop.makeSortable(div);

		return div;
	},
	expandTreeNode: (id, stack, lastId) => {
		if (!id) {
			return;
		}
		lastId = lastId || id;
		stack = stack || [];
		stack.push(id);
		Command.get(id, 'id,parent', (obj) => {
			if (obj.parent) {
				_Pages.expandTreeNode(obj.parent.id, stack, lastId);
			} else {
				_Entities.expandAll(stack.reverse(), lastId);
			}
		});
	},
	highlight: (id) => {
		let node = Structr.node(id);
		if (node) {
			node.parent().removeClass('nodeHover');
			node.addClass('nodeHover');
		}

		let activeNode = Structr.node(id, '#active_');
		if (activeNode) {
			activeNode.parent().removeClass('nodeHover');
			activeNode.addClass('nodeHover');
		}
	},
	unhighlight: (id) => {
		let node = Structr.node(id);
		if (node) {
			node.removeClass('nodeHover');
		}
		let activeNode = Structr.node(id, '#active_');
		if (activeNode) {
			activeNode.removeClass('nodeHover');
		}
	},
	getActiveTabLeft: () => {
		return LSWrapper.getItem(_Pages.activeTabLeftKey, 'pagesTab');
	},
	getActiveTabRight: () => {
		return LSWrapper.getItem(_Pages.activeTabRightKey);
	},
	leftSlideoutTrigger: (triggerEl, slideoutElement, otherSlideouts, openCallback, closeCallback) => {

		let leftResizer = document.querySelector('.column-resizer-left');

		if (!$(triggerEl).hasClass('noclick')) {

			if (slideoutElement.position().left < -1) {
				Structr.closeLeftSlideOuts(otherSlideouts, closeCallback);
				Structr.openLeftSlideOut(triggerEl, slideoutElement, openCallback);
				if (leftResizer) {
					leftResizer.classList.remove('hidden');
				}
			} else {
				Structr.closeLeftSlideOuts([slideoutElement], closeCallback);
				if (leftResizer) {
					leftResizer.classList.add('hidden');
				}
			}
		}
	},
	rightSlideoutClickTrigger: (triggerEl, slideoutElement, otherSlideouts, openCallback, closeCallback) => {

		if (!$(triggerEl).hasClass('noclick')) {

			if (Math.abs(slideoutElement.position().left - $(window).width()) <= 3) {
				Structr.closeSlideOuts(otherSlideouts, closeCallback);
				Structr.openSlideOut(triggerEl, slideoutElement, openCallback);
				document.querySelector('.column-resizer-right').classList.remove('hidden');
			} else {
				Structr.closeSlideOuts([slideoutElement], closeCallback);
				document.querySelector('.column-resizer-right').classList.add('hidden');
			}
		}
	},
	leftSlideoutClosedCallback: (wasOpen) => {
		if (wasOpen) {
			LSWrapper.removeItem(_Pages.activeTabLeftKey);

			_Pages.resize();
		}
	},
	rightSlideoutClosedCallback: (wasOpen) => {
		if (wasOpen) {
			LSWrapper.removeItem(_Pages.activeTabRightKey);

			_Pages.resize();
		}
	},

	localizations: {
		lastSelectedPageKey: 'structrLocalizationsLastSelectedPageKey_' + location.port,
		lastUsedLocaleKey: 'structrLocalizationsLastUsedLocale_' + location.port,
		wrapperTypeForContextMenu: 'WrappedLocalizationForPreview',
		getContextMenuElements: function (div, wrappedEntity) {

			let entity         = wrappedEntity.entity;
			const isSchemaNode = (entity.type === 'SchemaNode');

			let elements = [];

			if (isSchemaNode) {

				elements.push({
					name: 'Go to Schema Node',
					clickHandler: function() {

						let pathToOpen = 'custom--' + entity.id;

						window.location.href = '#code';
						window.setTimeout(function() {
							_Code.findAndOpenNode(pathToOpen, false);
						}, 1000);

						return false;
					}
				});
			}

			return elements;
		},

		refreshPagesForLocalizationPreview: async () => {

			let pageSelect       = document.getElementById('localization-preview-page');
			let localeInput      = document.querySelector('#localizations input.locale');
			fastRemoveAllChildren(pageSelect);

			let lastSelectedPage = LSWrapper.getItem(_Pages.localizations.lastSelectedPageKey);
			let lastUsedLocale   = LSWrapper.getItem(_Pages.localizations.lastUsedLocaleKey);
			if (lastUsedLocale) {
				localeInput.value = lastUsedLocale;
			}

			let pages = await Command.queryPromise('Page', 1000, 1, 'name', 'asc', { hidden: false }, true, null, 'id,name');

			for (let page of pages) {

				let option = document.createElement('option');
				option.value = page.id;
				option.textContent = page.name;

				// first assumption: if we are previewing a page, use that page
				if (page.id === _Pages.previews.activePreviewPageId) {
					option.selected = true;
				}

				// second assumption: use previously selected page if not actively previewing a page
				if (!_Pages.previews.activePreviewPageId && page.id === lastSelectedPage) {
					option.selected = true;
				}

				pageSelect.appendChild(option);
			}
		},
		refreshLocalizations: async () => {

			let localizationsContainer = document.querySelector('#localizations div.inner div.results');
			let localeInput            = document.querySelector('#localizations input.locale');
			let locale                 = localeInput.value;
			let pageSelect             = document.getElementById('localization-preview-page');

			if (!locale) {
				blinkRed(localeInput);
				return;
			}

			LSWrapper.setItem(_Pages.localizations.lastSelectedPageKey, pageSelect.value);
			LSWrapper.setItem(_Pages.localizations.lastUsedLocaleKey, locale);

			let id                = pageSelect.value;
			let detailObjectId    = LSWrapper.getItem(_Pages.detailsObjectIdKey + id);
			let queryString       = LSWrapper.getItem(_Pages.requestParametersKey + id);
			let localizations     = await Command.listLocalizations(id, locale, detailObjectId, queryString);
			let localizationIdKey = 'localizationId';
			let previousValueKey  = 'previousValue';

			fastRemoveAllChildren(localizationsContainer);

			if (localizations.length == 0) {

				localizationsContainer.innerHTML = 'No localizations found in page.';

			} else {

				for (let res of localizations) {

					let modelNode = (res.node) ? StructrModel.createFromData(res.node) : { type: "Untraceable source (probably static method)", isFake: true };
					let tbody     = _Pages.localizations.getNodeForLocalization(localizationsContainer, modelNode);
					let row       = Structr.createSingleDOMElementFromHTML(`<tr>
							<td><div class="key-column allow-break">${escapeForHtmlAttributes(res.key)}</div></td>
							<td class="domain-column">${res.domain}</td>
							<td class="locale-column">${((res.localization !== null) ? res.localization.locale : res.locale)}</td>
							<td class="input"><input class="localized-value" placeholder="...">${_Icons.getSvgIcon('trashcan', 16, 16, _Icons.getSvgIconClassesForColoredIcon(['icon-red', 'delete', 'mr-2', 'ml-2']))}</td>
						</tr>`
					);
					let input     = row.querySelector('input.localized-value');

					if (res.localization) {
						let domainIdentical = (res.localization.domain === res.domain) || (!res.localization.domain && !res.domain);
						if (!domainIdentical) {
							res.localization = null;
							// we are getting the fallback localization for this entry - do not show this as we would update the wrong localization otherwise
						}
					}

					if (res.localization !== null) {
						row.classList.add('has-value');
						input.value = res.localization.localizedName;
						input.dataset[localizationIdKey] = res.localization.id;
						input.dataset[previousValueKey]  = res.localization.localizedName;
					}

					row.querySelector('.delete').addEventListener('click', (event) => {
						event.preventDefault();

						let id = input.dataset[localizationIdKey];

						if (id) {
							_Entities.deleteNodes(this, [{id: id, name: input.value}], false, () => {
								row.classList.remove('has-value');
								input.value = '';
								delete input.dataset[localizationIdKey];
								delete input.dataset[previousValueKey];
							});
						}
					});

					input.addEventListener('click', (e) => {
						e.stopPropagation();
					})

					input.addEventListener('blur', (event) => {

						let newValue       = input.value;
						let localizationId = input.dataset[localizationIdKey];
						let previousValue  = input.dataset[previousValueKey];
						let isChange       = (!previousValue && newValue !== '') || (previousValue && previousValue !== newValue);

						if (isChange) {

							if (localizationId) {

								Command.setProperties(localizationId, { localizedName: newValue }, () => {
									blinkGreen(input);
									input.dataset[previousValueKey] = newValue;
								});

							} else {

								Command.create({
										type: 'Localization',
										name: res.key,
										domain: res.domain || null,
										locale: res.locale,
										localizedName: newValue
									},
									function(createdLocalization) {
										input.dataset[localizationIdKey] = createdLocalization.id;
										input.dataset[previousValueKey]  = newValue;
										row.classList.add('has-value');
										blinkGreen(input);
									});
							}
						}
					});

					tbody.append(row);
				};
			}
		},
		getNodeForLocalization: (container, entity) => {

			let idString = 'locNode_' + entity.id;
			let existing = container.querySelector('#' + idString);

			if (existing) {
				return existing.querySelector('tbody');
			}

			let displayName = getElementDisplayName(entity);
			let iconClass   = (entity.isDOMNode) ? _Icons.getFullSpriteClass(entity.isContent ? _Elements.getContentIcon(entity) : _Elements.getElementIcon(entity)) : 'fa fa-file-code-o';
			let detailHtml  = '';

			if (entity.type === 'Content') {

				detailHtml = entity.content;

			} else if (entity.type === 'Template') {

				if (entity.name) {
					detailHtml = displayName;
				} else {
					detailHtml = escapeTags(entity.content);
				}

			} else if (!entity.isDOMNode) {
				detailHtml = `<b title="${escapeForHtmlAttributes(entity.type)}" class="tag_ name_">${entity.type}</b>`;
			} else {
				detailHtml = `<b title="${escapeForHtmlAttributes(displayName)}" class="tag_ name_">${displayName}</b>`;
			}

			let div = Structr.createSingleDOMElementFromHTML(`
				<div id="${idString}" class="node localization-element ${(entity.tag === 'html' ? ' html_element' : '')}" data-node-id="${(_Entities.isContentElement(entity) ? entity.parent.id : entity.id )}">
					<div class="node-container flex items-center">
						<div class="node-selector"></div>
						<i class="typeIcon ${iconClass}"></i><span class="abbr-ellipsis abbr-pages-tree">${detailHtml}${_Elements.classIdString(entity._html_id, entity._html_class)}</span>
						<div class="icons-container flex items-center"></div>
					</div>
					<table>
						<thead>
							<tr>
								<th>Key</th>
								<th>Domain</th>
								<th>Locale</th>
								<th>Localization</th>
							</tr>
						</thead>
						<tbody></tbody>
					</table>
				</div>
			`);

			let $div           = $(div);
			let iconsContainer = $('.icons-container', $div);

			if (!entity.isDOMNode && !entity.isFake) {

				// do not use pointer cursor
				div.classList.add('schema');

				Command.queryPromise('SchemaNode', 1, 1, 'name', 'asc', { name: entity.type }, true).then((schemaNodes) => {

					if (schemaNodes.length === 1) {

						_Entities.appendContextMenuIcon(iconsContainer, {
							type: _Pages.localizations.wrapperTypeForContextMenu,
							entity: schemaNodes[0]
						}, false);
					}
				});
			}

			container.appendChild(div);

			_Entities.setMouseOver($div, undefined, ((entity.syncedNodesIds && entity.syncedNodesIds.length) ? entity.syncedNodesIds : [entity.sharedComponentId] ));

			if (entity.isDOMNode) {
				_Pages.registerDetailClickHandler($div, entity);
				_Elements.clickOrSelectElementIfLastSelected($div, entity);
			}

			return div.querySelector('tbody');
		}
	},

	previews: {
		loadPreviewTimer : undefined,
		previewElement: undefined,
		selectedElementOrigSource: null,
		activePreviewPageId: null,
		activePreviewHighlightElementId: null,

		findDroppablesInIframe: function (iframeDocument, id) {
			var droppables = iframeDocument.find('[data-structr-id]');
			if (droppables.length === 0) {
				var html = iframeDocument.find('html');
				html.attr('data-structr-id', id);
				html.addClass('structr-element-container');
			}
			droppables = iframeDocument.find('[data-structr-id]');
			return droppables;
		},

		previewIframeLoaded: function (iframe, highlightElementId) {

			let designToolsActive = false;
			if (LSWrapper.getItem(_Pages.activeTabRightKey) === 'paletteTab') {
				// Design tools are open
				designToolsActive = true;
			}

			let doc = $(iframe.contentDocument || iframe.contentWindow.document);

			try {
				let head = doc.find('head');
				if (head) {
					head.append('<style media="screen">\n'
						+ '* { z-index: 0}\n'
						+ '.nodeHover { -moz-box-shadow: 0 0 5px #888; -webkit-box-shadow: 0 0 5px #888; box-shadow: 0 0 5px #888; }\n'
						+ '.structr-content-container { min-height: .25em; min-width: .25em; }\n'
						+ '.structr-element-container-active:hover { -moz-box-shadow: 0 0 5px #888; -webkit-box-shadow: 0 0 5px #888; box-shadow: 0 0 5px #888; }\n'
						+ '.structr-element-container-selected { -moz-box-shadow: 0 0 8px #860; -webkit-box-shadow: 0 0 8px #860; box-shadow: 0 0 8px #860; }\n'
						+ '.structr-element-container-selected:hover { -moz-box-shadow: 0 0 10px #750; -webkit-box-shadow: 0 0 10px #750; box-shadow: 0 0 10px #750; }\n'
						+ '.structr-editable-area { background-color: #ffe; -moz-box-shadow: 0 0 5px #888; -webkit-box-shadow: 0 0 5px yellow; box-shadow: 0 0 5px #888; }\n'
						+ '.structr-editable-area-active { background-color: #ffe; border: 1px solid orange ! important; color: #333; }\n'
						+ '.link-hover { border: 1px solid #00c; }\n'
						//+ '.edit_icon, .add_icon, .delete_icon, .close_icon, .key_icon {  cursor: pointer; heigth: 16px; width: 16px; vertical-align: top; float: right;  position: relative;}\n'
						/**
						 * Fix for bug in Chrome preventing the modal dialog background
						 * from being displayed if a page is shown in the preview which has the
						 * transform3d rule activated.
						 */
						+ '.navbar-fixed-top { -webkit-transform: none ! important; }\n'
						+ '</style>\n');

					if (designToolsActive) {

						const mouseOverHandler = (e) => {
							let tagName     = e.target.tagName;
							let idString    = e.target.id;
							let classString = e.target.className;
							let el = e.target;
							el.classList.add('design-tools-hover');

							// if (!document.getElementById('design-tools-area').classList.contains('locked')) {
							// 	document.getElementById('design-tools-hover-tag-name-input').value = tagName;
							// 	document.getElementById('design-tools-hover-id-input').value       = idString;
							// 	document.getElementById('design-tools-hover-class-input').value    = classString;
							// }

						};

						const mouseOutHandler = (e) => {
							let tagName     = e.target.tagName;
							let idString    = e.target.id;
							let classString = e.target.className;
							let el = e.target;
							el.classList.remove('design-tools-hover');
							// document.getElementById('design-tools-hover-tag-name-input').value = tagName;
							// document.getElementById('design-tools-hover-id-input').value       = idString;
							// document.getElementById('design-tools-hover-class-input').value    = classString;
						};

						head.append('<style media="screen">\n'
							+ '*.design-tools-hover { -moz-box-shadow: 0 0 8px #72a132; -webkit-box-shadow: 0 0 8px #72a132; box-shadow: 0 0 8px #72a132; }\n'
							+ '*.design-tools-locked { -moz-box-shadow: 0 0 8px #595 ; -webkit-box-shadow: 0 0 8px #595; box-shadow: 0 0 8px #595; }\n'
							+ '</style>\n');

						for (let el of doc[0].querySelectorAll('*')) {
							// el.addEventListener('mouseenter', (e) => {
							// 	console.log('Mouseenter:', e.target);
							// 	document.getElementById('design-tools-hover-selector-input').value = e.target;
							// });
							el.addEventListener('mouseover', mouseOverHandler);
							el.addEventListener('mouseout', mouseOutHandler);

							el.addEventListener('click', (e) => {
								e.preventDefault();
								e.stopPropagation();
								//document.getElementById('design-tools-area').classList.add('locked');
								for (let otherEl of doc[0].querySelectorAll('*')) {
									otherEl.classList.remove('design-tools-hover');
									otherEl.classList.remove('design-tools-locked');
									//otherEl.removeEventListener('mouseover', mouseOverHandler);
									//otherEl.removeEventListener('mouseout', mouseOutHandler);
								}
								el.classList.add('design-tools-locked');

								// remove design-tool specific classes
								let html = el.outerHTML.replaceAll(/ ?design-tools-locked/g, '').replaceAll(' class=""', '');

								_Pages.designTools.selectedElementOrigSource = html;
								_Pages.designTools.sourceEditor.setValue(html);
								//_Pages.designTools.sourceEditor.getAction().run();
								_Pages.designTools.sourceEditor.getAction('editor.action.formatDocument').run();
								_Pages.designTools.selectedElement = el;
								_Pages.designTools.selectedElementSelector = TopLevelObject.DOMPresentationUtils.cssPath(el);

								let childTemplateNameInput = document.getElementById('design-tools-template-name-input');
								let tagString   = el.tagName[0].toUpperCase() + el.tagName.toLowerCase().slice(1) + ' Element';
								let idString    = el.id ? ('#' + el.id) : '';
								let classString = Array.from(el.classList).filter(c => c !== 'design-tools-locked').map(t => t.length > 1 ? '.' + t : null).join(' ');
								childTemplateNameInput.value = tagString + ((el.id || classString) ? ' (' : '')
										+ idString + ((el.id && classString) ? ' ' : '')
										+ classString
									+ ((el.id || classString) ? ')' : '');

							});
						}
					}

				}

				_Pages.previews.findDroppablesInIframe(doc, highlightElementId).each(function(i, element) {

					var el = $(element);

//					_Dragndrop.makeDroppable(el, highlightElementId);

					var structrId = el.attr('data-structr-id');
					if (structrId) {

						var offsetTop = -30;
						var offsetLeft = 0;
						el.on({
							click: function(e) {
								e.stopPropagation();
								var self = $(this);
								var selected = self.hasClass('structr-element-container-selected');
								self.closest('body').find('.structr-element-container-selected').removeClass('structr-element-container-selected');
								if (!selected) {
									self.toggleClass('structr-element-container-selected');
								}

								_Entities.deselectAllElements();
//								_Pages.databinding.displayDataBinding(structrId);

								if (!Structr.node(structrId)) {
									_Pages.expandTreeNode(structrId);
								} else {
									var treeEl = Structr.node(structrId);
									if (treeEl && !selected) {
										_Entities.highlightElement(treeEl);
									}
								}

								LSWrapper.setItem(_Entities.selectedObjectIdKey, structrId);
								return false;
							},
							mouseover: function(e) {
								e.stopPropagation();
								var self = $(this);
								self.addClass('structr-element-container-active');
								_Pages.highlight(structrId);
								var pos = self.position();
								var header = self.children('.structr-element-container-header');
								header.css({
									position: "absolute",
									top: pos.top + offsetTop + 'px',
									left: pos.left + offsetLeft + 'px',
									cursor: 'pointer'
								}).show();
							},
							mouseout: function(e) {
								e.stopPropagation();
								var self = $(this);
								self.removeClass('.structr-element-container');
								var header = self.children('.structr-element-container-header');
								header.remove();
								_Pages.unhighlight(structrId);
							}
						});
					}
				});

			} catch (e) { console.log('Error:', e)}

			_Pages.previews.activateComments(doc);
		},

		getComments: (el) => {

			let comments = [];
			let child    = el.firstChild;

			while (child) {

				if (child.nodeType === 8) {
					let id = child.nodeValue.extractVal('data-structr-id');

					if (id) {
						let raw = child.nodeValue.extractVal('data-structr-raw-value');

						if (raw !== undefined) {
							comments.push({
								id: id,
								node: child,
								rawContent: raw
							});
						}
					}
				}
				child = child ? child.nextSibling : child;
			}
			return comments;
		},

		getNonCommentSiblings: (el) => {

			let siblings = [];
			let sibling  = el.nextSibling;

			while (sibling) {
				if (sibling.nodeType === 8) {
					return siblings;
				}
				siblings.push(sibling);
				sibling = sibling.nextSibling;
			}
		},
		activateComments: function(doc, callback) {

			doc.find('*').each(function(i, element) {

				_Pages.previews.getComments(element).forEach(function(c) {

					let inner  = $(_Pages.previews.getNonCommentSiblings(c.node));
					let newDiv = $('<div data-structr-id="' + c.id + '" data-structr-raw-content="' + escapeForHtmlAttributes(c.rawContent, false) + '"></div>');

					newDiv.append(inner);
					$(c.node).replaceWith(newDiv);

					$(newDiv).on({
						mouseover: function(e) {
							e.stopPropagation();
							let self = $(this);

							self.addClass('structr-editable-area');
							_Pages.highlight(self.attr('data-structr-id'));
						},
						mouseout: function(e) {
							e.stopPropagation();
							let self = $(this);

							self.removeClass('structr-editable-area');
							_Pages.unhighlight(self.attr('data-structr-id'));
						},
						click: function(e) {
							e.stopPropagation();
							e.preventDefault();
							let self = $(this);

							if (_Pages.contentSourceId) {
								// click on same element again?
								if (self.attr('data-structr-id') === _Pages.contentSourceId) {
									return;
								}
							}
							_Pages.contentSourceId = self.attr('data-structr-id');

							if (self.hasClass('structr-editable-area-active')) {
								return false;
							}
							self.removeClass('structr-editable-area').addClass('structr-editable-area-active').prop('contenteditable', true).focus();

							// Store old text in global var and attribute
							_Pages.textBeforeEditing = self.text();

							let srcText = expandNewline(self.attr('data-structr-raw-content'));

							// Replace only if it differs (e.g. for variables)
							if (srcText !== _Pages.textBeforeEditing) {
								self.html(srcText);
								_Pages.textBeforeEditing = srcText;
							}
							_Pages.expandTreeNode(_Pages.contentSourceId);
							return false;
						},
						blur: function(e) {
							e.stopPropagation();
							_Pages.saveInlineElement(this, callback);
						}
					});
				});
			});
		},
		isPreviewActive: () => {

			// only reload if the iframe is already present!
			let iframe = _Pages.centerPane.querySelector('iframe');

			if (iframe) {
				return true;
			}

			return false;
		},
		getBaseUrlForPage: (entity) => {
			let pagePath = entity.path ? entity.path.replace(/^\//, '') : entity.name;
			let detailsObject     = (LSWrapper.getItem(_Pages.detailsObjectIdKey + entity.id) ? '/' + LSWrapper.getItem(_Pages.detailsObjectIdKey + entity.id) : '');
			let previewUrl        = (entity.site && entity.site.hostname ? '//' + entity.site.hostname + (entity.site.port ? ':' + entity.site.port : '') + '/' : Structr.viewRootUrl) + pagePath + detailsObject;

			return previewUrl;
		},
		getUrlForPage: (entity) => {
			let requestParameters = (LSWrapper.getItem(_Pages.requestParametersKey + entity.id) ? '?' + LSWrapper.getItem(_Pages.requestParametersKey + entity.id) : '');
			return _Pages.previews.getBaseUrlForPage(entity) + requestParameters;
		},
		getUrlForPreview: (entity) => {
			let requestParameters = (LSWrapper.getItem(_Pages.requestParametersKey + entity.id) ? '&' + LSWrapper.getItem(_Pages.requestParametersKey + entity.id) : '');
			return _Pages.previews.getBaseUrlForPage(entity) + '?' + Structr.getRequestParameterName('edit') + '=2' + requestParameters;
		},
		showPreviewInIframe: (pageId, highlightElementId) => {

			if (pageId) {

				let innerFn = () => {

					_Pages.previews.activePreviewPageId = pageId;
					if (highlightElementId) {
						_Pages.previews.activePreviewHighlightElementId = highlightElementId;
					}

					Command.get(pageId, 'id,name,path,site', (pageObj) => {

						_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.preview({ pageId: pageObj.id }));

						let iframe = _Pages.centerPane.querySelector('iframe');

						if (highlightElementId) {
							_Entities.highlightElement(Structr.node(highlightElementId));
						}

						iframe.onload = () => {

							_Pages.previews.previewIframeLoaded(iframe, highlightElementId);

							let doc       = iframe.contentDocument || iframe.contentWindow.document;
							let previewEl = doc.querySelector('[data-structr-id="' + highlightElementId + '"]');

							for (let el of doc.querySelectorAll('.structr-element-container-selected')) {
								el.classList.remove('structr-element-container-selected');
							}

							previewEl?.classList.add('structr-element-container-selected');
						}

						iframe.src = _Pages.previews.getUrlForPreview(pageObj);
					});

					_Pages.resize();
				};

				if (_Pages.previews.loadPreviewTimer) {
					window.clearTimeout(_Pages.previews.loadPreviewTimer);
				}

				_Pages.previews.loadPreviewTimer = window.setTimeout(innerFn, 100);
			}
		},
		showPreviewInIframeIfVisible: (pageId, highlightElementId) => {

			if (_Pages.previews.isPreviewActive()) {
				_Pages.previews.showPreviewInIframe(pageId, highlightElementId);
			}
		},
		reloadPreviewInIframe: () => {

			if (_Pages.previews.isPreviewActive()) {
				_Pages.previews.showPreviewInIframe(_Pages.previews.activePreviewPageId, _Pages.previews.activePreviewHighlightElementId);
			}
		},
		isPreviewForActiveForPage: (pageId) => {

			return (_Pages.previews.activePreviewPageId === pageId && _Pages.previews.isPreviewActive());
		},
		modelForPageUpdated: (pageId) => {

			if (_Pages.previews.isPreviewForActiveForPage(pageId)) {
				_Pages.previews.reloadPreviewInIframe();
			}
		},
		configurePreview: (entity, container) => {

			let detailsObjectIdInput = container.querySelector('#_details-object-id');

			detailsObjectIdInput.addEventListener('change', () => {

				let oldVal = LSWrapper.getItem(_Pages.detailsObjectIdKey + entity.id) || null;
				let newVal = detailsObjectIdInput.value;
				if (newVal !== oldVal) {

					blinkGreen(detailsObjectIdInput);

					if (newVal === '') {
						LSWrapper.removeItem(_Pages.detailsObjectIdKey + entity.id);
					} else {
						LSWrapper.setItem(_Pages.detailsObjectIdKey + entity.id, newVal);
					}

					_Pages.previews.modelForPageUpdated(entity.id);
				}
			});

			let requestParametersInput = container.querySelector('#_request-parameters');

			requestParametersInput.addEventListener('change', () => {
				let oldVal = LSWrapper.getItem(_Pages.requestParametersKey + entity.id) || null;
				let newVal = requestParametersInput.value;
				if (newVal !== oldVal) {

					blinkGreen(requestParametersInput);

					if (newVal === '') {
						LSWrapper.removeItem(_Pages.requestParametersKey + entity.id);
					} else {
						LSWrapper.setItem(_Pages.requestParametersKey + entity.id, newVal);
					}

					_Pages.previews.modelForPageUpdated(entity.id);
				}
			});

			let autoRefreshCheckbox = container.querySelector('#_auto-refresh');
			autoRefreshCheckbox.addEventListener('change', () => {
				let key = _Pages.autoRefreshDisabledKey + entity.id;
				let autoRefreshDisabled = (LSWrapper.getItem(key) === '1');

				if (autoRefreshDisabled) {
					LSWrapper.removeItem(key);
				} else {
					LSWrapper.setItem(key, '1');
				}
				blinkGreen(autoRefreshCheckbox.parentNode);
			});
		},
	},

	designTools: {
		sourceEditor: null,
		selectedElement: null,
		reload: () => {
			//console.log('Design tools opened');

			let html = `
				<div class="inner">
					<div class="mr-12" id="design-tools-area">

						<h3>Import from page</h3>
						<div class="w-full mb-4">
							<label class="block mb-2" for="design-tools-url-input">Enter URL of example page to preview</label>
							<input class="w-full rounded-r" style="margin-left: -1px" type="text" id="design-tools-url-input">
						</div>
						<div class="w-full mb-4">
							<label class="block mb-2" for="design-tools-url-history-select">URL history</label>
							<select id="design-tools-url-history-select" class=""><option></option></optin></select>
						</div>
						<div class="w-full mb-4">
							<label class="block mb-2" for="design-tools-page-name-input">Page name</label>
							<input id="design-tools-page-name-input" class="w-full" type="text">
						</div>
						<div class="w-full mb-4">
							<label class="block mb-2" for="design-tools-page-template-name-input">Page template name</label>
							<input id="design-tools-page-template-name-input" class="w-full" type="text">
						</div>
						<div class="w-full mb-8">
							<button class="hover:bg-gray-100 focus:border-gray-666 active:border-green" id="design-tools-create-page-button">Create new page</button>
						</div>

						<h3>Select element</h3>
						<p>Hover over elements in the preview page. Click to select and lock an element.</p>
						<div class="grid grid-cols-6 gap-4">
							<!--
							<div class="col-span-3 mr-4">
								<label class="block mb-2" for="design-tools-url-input">Tag name</label>
								<input id="design-tools-hover-tag-name-input" class="w-full" type="text">
							</div>
							<div class="col-span-3">
								<label class="block mb-2" for="design-tools-url-input">ID</label>
								<input id="design-tools-hover-id-input" class="w-full" type="text">
							</div>
							<div class="col-span-6">
								<label class="block mb-2" for="design-tools-url-input">CSS Classes</label>
								<input id="design-tools-hover-class-input"class="w-full" type="text">
							</div>
							-->
							<div class="col-span-6 h-80 mb-4" id="design-tool-source-editor-area">
								<label class="block mb-2" for="design-tools-source-code">Source code</label>
								<!--textarea id="design-tool-source-textarea" class="w-full h-40"></textarea-->
							</div>
							<div class="col-span-6">
								<label class="block mb-2" for="design-tools-template-name-input">Template name</label>
								<input id="design-tools-template-name-input" class="w-full" type="text">
							</div>
							<div class="col-span-3">
								<label class="" for="design-tools-create-as-dom-tree">Create as DOM tree</label>
							</div>
							<div class="col-span-3">
								<input id="design-tools-create-as-dom-tree" class="" type="checkbox">
							</div>
							<div class="col-span-3">
								<label class="" for="design-tools-remove-siblings">Remove similar siblings (for repeater)</label>
							</div>
							<div class="col-span-3">
								<input id="design-tools-remove-siblings" class="" type="checkbox">
							</div>
							<div class="cols-span-6">
								<button class="hover:bg-gray-100 focus:border-gray-666 active:border-green" id="design-tools-create-child-template">Create sub node</button>
							</div>

						</div>


					</div>
				</div>
			`;

			let designTools = document.getElementById('palette');
			fastRemoveAllChildren(designTools);
			designTools.insertAdjacentHTML('afterbegin', html);

			let pageTemplateNameInput = document.getElementById('design-tools-page-template-name-input');
			let pageNameInput         = document.getElementById('design-tools-page-name-input');
			let urlInput              = document.getElementById('design-tools-url-input');


			document.getElementById('design-tools-create-page-button').addEventListener('click', (e) => {

				Command.importPageAsTemplate(urlInput.value, pageNameInput.value, pageTemplateNameInput.value, (newPage) => {
					console.log('Page imported as template', newPage);

					//Command.setProperty(newPage.children[0].id)

				});

				// Command.create({ type: 'Page', name: pageNameInput.value }, (newPage) => {
				//
				// 	//console.log('New page created', newPage);
				// 	let previewIframe = document.querySelector('.previewBox iframe');
				// 	let html = previewIframe.contentDocument.documentElement.outerHTML.replaceAll(/ ?design-tools-locked/g, '').replaceAll(' class=""', '');
				// 	//console.log(previewIframe.contentDocument); return;
				// 	let pageTemplateNameInput = document.getElementById('design-tools-page-template-name-input');
				//
				// 	fetch(urlInput.value)
				// 		.then(response => response.text())
				// 		.then(html => {
				//
				// 			Command.create({
				// 				type: 'Template',
				// 				name: pageTemplateNameInput.value,
				// 				content: html,
				// 				contentType: 'text/html'
				// 			}, (newTemplate) => {
				// 				console.log('New template created', newTemplate);
				// 				Command.appendChild(newTemplate.id, newPage.id);
				// 			});
				//
				// 		});
				// });
			});

			const createChildTemplates = (obj, parentTemplateContent) => {

				//console.log('Root of createChildTemplates with obj', obj);

				for (let child of obj.children) {

					//console.log('Testing child', child);

					if (child.type === 'Template') {

						Command.get(child.id, 'id,type,name,content,children', (template) => {
							//console.log('Template found', childObj.content);

							// Match template content with source code of currently selected element
							// let selectedElementSource = _Pages.designTools.selectedElementOrigSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
							// let templateContent = template.content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

							let selectedElementSource = _Pages.designTools.selectedElementOrigSource.replace(/[.*+?^#%${}()|[\]\\]/g, '\\$&');
							let templateContent = template.content; //.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

							//let regex = new RegExp(RegExp.escape(selectedElementSource));
							let regex = new RegExp(selectedElementSource);
							let matches = regex.test(templateContent);
							let el = _Pages.designTools.selectedElement;

							let childTemplateNameInput = document.getElementById('design-tools-template-name-input');
							let newChildTemplateName   = childTemplateNameInput.value;

							//let tmpDoc      = document.implementation.createHTMLDocument();
							//let tmpEl       = tmpDoc.createElement('html');
							//tmpEl.innerHTML = selectedElementSource;

							let templateTmpDoc      = document.implementation.createHTMLDocument();
							let templateTmpEl       = templateTmpDoc.createElement('html');
							templateTmpEl.innerHTML = templateContent;

							console.log(parentTemplateContent);
							console.log(templateContent);

							// TODO: Bei der Suche in Child-Elementen muss der relative Pfad berücksichtigt werden.
							// Das Matching muss von der Stelle aus gemacht werden, wo das ${include_child()} im Parent-Template steht.
							// Oder es muss der Reverse CSS Path immer mit class (und id) aufgelöst werden ...

							//console.log(templateTmpEl);

							let selectedEl = templateTmpEl.querySelector(_Pages.designTools.selectedElementSelector); //.replace('html > body > ', ''));
							//console.log(_Pages.designTools.selectedElementSelector);
							//console.log(selectedEl); return;



							//console.log(templateTmpEl); return;

							if (selectedEl) {

								selectedEl.outerHTML = '${include_child(\'' + newChildTemplateName + '\')}';

								console.log('Match!');

								// If it matches, replace by ${include_child(...)} expression

								//Command.setProperty(template.id, 'content', templateContent.replace(regex, '${include_child(\'' + newChildTemplateName + '\')}\n'));

								let newHTML = templateContent.startsWith('<!DOCTYPE') ? '<!DOCTYPE html>\n' + templateTmpEl.outerHTML : templateTmpEl.querySelector('html > body').innerHTML;

								Command.setProperty(template.id, 'content', newHTML);

								let newTemplateContent = _Pages.designTools.sourceEditor.getValue();

								Command.create({
									type: 'Template',
									name: newChildTemplateName,
									content: newTemplateContent,
									contentType: 'text/html'
								}, (newTemplate) => {
									//console.log('New template created', newTemplate);
									Command.appendChild(newTemplate.id, template.id);
								});

							} else {
								console.log('No match, step down to', template);
								createChildTemplates(template, templateContent);
							}
						});

					}
				}


			};

			document.getElementById('design-tools-create-child-template').addEventListener('click', (e) => {
				// To create a new template, we must figure out which is the parent template first
				// Get currently selected page and iterate through the templates to find the corresponding HTML
				let activePageId = _Pages.previews.activePreviewPageId;
				Command.get(activePageId, 'id,type,name,children', (pageObj) => {
					createChildTemplates(pageObj);
				});
			});

			const updateUrlHistorySelect = () => {
				let urlHistorySelectEl = document.getElementById('design-tools-url-history-select');
				fastRemoveAllChildren(urlHistorySelectEl);
				urlHistorySelectEl.insertAdjacentHTML('beforeend', '<option></option>');
				for (let urlHistoryEntry of (LSWrapper.getItem('design-tools-url-history') || []).reverse()) {
					urlHistorySelectEl.insertAdjacentHTML('beforeend', '<option>' + urlHistoryEntry + '</option>');
				}
			}

			const loadPreviewPage = (url) => {
				let previewIframe;
				if (!_Pages.previews.isPreviewActive()) {
					_Pages.centerPane.insertAdjacentHTML('beforeend', _Pages.templates.preview({ pageId: null }));
					previewIframe = document.querySelector('.previewBox iframe');
					_Pages.showTabsMenu();
					previewIframe.onload = () => {
						_Pages.previews.previewIframeLoaded(previewIframe);
					};
				}
				_Pages.hideAllFunctionBarTabs();
				document.querySelector('a[href="#pages:preview"]').closest('li').classList.remove('hidden');
				document.querySelector('a[href="#pages:preview"]').click();

				fetch('/structr/proxy?url=' + url)
					.then(response => response.text())
					.then(html => {
						let previewIframe = document.querySelector('.previewBox iframe');
						previewIframe.addEventListener('load', (e) => {

							let pageName;
							let pageHref = previewIframe.contentDocument.documentElement.querySelector('base').href;
							if (pageHref) {
								let hrefParts = pageHref.split('/');
								pageName = hrefParts[hrefParts.length-2];
							}
							pageNameInput.value = pageName;

							let pageTitle = previewIframe.contentDocument.documentElement.querySelector('title').innerText;
							pageTemplateNameInput.value = pageTitle;
						});

						previewIframe.srcdoc = html;
					});
			}

			let urlHistorySelectEl = document.getElementById('design-tools-url-history-select');
			urlHistorySelectEl.addEventListener('change', (e) => {
				let url = e.target.value;
				urlInput.value = url;
				loadPreviewPage(url);
			});

			updateUrlHistorySelect();

			urlInput.addEventListener('keyup', (e) => {
				let inputElement = e.target;
				switch (e.key) {
					case 'Enter':

						let history = LSWrapper.getItem('design-tools-url-history');
						if (!history || (history.length && history.indexOf(inputElement.value) === -1)) {
							LSWrapper.setItem('design-tools-url-history', (LSWrapper.getItem('design-tools-url-history') || []).concat(inputElement.value));
						}
						updateUrlHistorySelect();

						loadPreviewPage(inputElement.value);

						break;
					default:
						return;
				}
			});

			let sourceEditorTextElement = document.getElementById('design-tool-source-textarea');
			let sourceEditorConfig = {
				//value: 'test',
				language: 'text/html',
				lint: true,
				autocomplete: true,
				autoIndent: 'full',
				automaticLayout: true,
				//changeFn: (editor, entity) => { },
				isAutoscriptEnv: true,
				//saveFn: saveFunction,
				//saveFnText: 'SAVE TEXT FÜRS CONTEXT MENU IIRC'
			};

			let sourceEditorArea = document.getElementById('design-tool-source-editor-area');
			//let sourceEditor = _Editors.getMonacoEditor({ id: 'dummy-id'}, 'id', $(sourceEditorArea), sourceEditorConfig);

			_Pages.designTools.sourceEditor = monaco.editor.create(sourceEditorArea, sourceEditorConfig);

		}
	},

	sharedComponents: {
		reload: () => {

			if (!_Pages.componentsSlideout) return;

			Command.listComponents(1000, 1, 'name', 'asc', function(result) {

				_Pages.componentsSlideout.find(':not(.slideout-activator)').remove();

				_Pages.componentsSlideout.append(`
					<div id="newComponentDropzone" class="element-dropzone">
						<div class="info-icon h-16 flex items-center justify-center">
							<i class="m-2 active ${_Icons.getFullSpriteClass(_Icons.add_icon)}"></i>
							<i class="m-2 inactive ${_Icons.getFullSpriteClass(_Icons.add_grey_icon)}"></i> Drop element here to create a new shared component
						</div>
					</div>
				`);
				let newComponentDropzone = $('#newComponentDropzone', _Pages.componentsSlideout);

				_Pages.componentsSlideout.append('<div id="componentsArea"></div>');
				_Pages.components = $('#componentsArea', _Pages.componentsSlideout);

				newComponentDropzone.droppable({
					drop: function(e, ui) {
						e.preventDefault();
						e.stopPropagation();

						if (ui.draggable.hasClass('widget')) {
							// special treatment for widgets dragged to the shared components area

						} else {
							// Create shadow page if not existing
							Structr.ensureShadowPageExists().then(() => {
								_Pages.sharedComponents.createNew(ui);
							});
						}
					}
				});

				_Dragndrop.makeSortable(_Pages.components);

				_Elements.appendEntitiesToDOMElement(result, _Pages.components);

				Structr.refreshPositionsForCurrentlyActiveSortable();
			});
		},
		createNew: function(el) {

			_Elements.dropBlocked = true;

			let sourceEl = $(el.draggable);
			let sourceId = Structr.getId(sourceEl);

			if (!sourceId) {
				return false;
			}

			let obj = StructrModel.obj(sourceId);

			if (obj && obj.syncedNodesIds && obj.syncedNodesIds.length || sourceEl.parent().attr('id') === 'componentsArea') {
				return false;
			}

			Command.createComponent(sourceId);

			_Elements.dropBlocked = false;
		},
	},

	unattachedNodes: {
		reload: () => {

			if (_Pages.unusedElementsSlideout.hasClass('open')) {

				_Pages.unattachedNodes.removeElementsFromUI();

				_Pages.unusedElementsTree.append(`<button class="btn disabled flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green" id="delete-all-unattached-nodes" disabled><span>Loading</span>${_Icons.getSvgIcon('waiting-spinner', 24, 24, ['ml-2'])}</button>`);

				let btn = $('#delete-all-unattached-nodes');
				btn.on('click', function() {
					Structr.confirmation('<p>Delete all DOM elements without parent?</p>',
						function() {
							Command.deleteUnattachedNodes();
							$.unblockUI({
								fadeOut: 25
							});
							Structr.closeSlideOuts([_Pages.unusedElementsSlideout], _Pages.rightSlideoutClosedCallback);
						});
				});

				_Dragndrop.makeSortable(_Pages.unusedElementsTree);

				Command.listUnattachedNodes(1000, 1, 'name', 'asc', (result) => {

					let count = result.length;
					if (count > 0) {
						btn.html(_Icons.getSvgIcon('trashcan', 16, 16, ['mr-2']) + ' Delete all (' + count + ')');
						btn.removeClass('disabled');
						btn.addClass('hover:bg-gray-100');
						btn.prop('disabled', false);
					} else {
						btn.text('No unused elements');
						btn.removeClass('hover:bg-gray-100');
					}

					_Elements.appendEntitiesToDOMElement(result, _Pages.unusedElementsTree);
				});
			}
		},
		removeElementsFromUI: () => {
			fastRemoveAllChildren(_Pages.unusedElementsTree[0]);
		},
		blinkUI: () => {
			blinkGreen('#elementsTab');
		}
	},

	linkableDialog: {
		nodeClasses: 'inline-flex flex-col items-start gap-x-2',
		show: (entity, targetNode) => {

			targetNode = $(targetNode);
			targetNode.empty();

			if (entity.tag !== 'img') {

				targetNode.append(`
					<p>Click on a Page, File or Image to establish a hyperlink to this &lt;${entity.tag}&gt; element.</p>
					<h3>Pages</h3><div class="linkBox" id="pagesToLink"></div>
				`);

				let pagesToLink = document.querySelector('#pagesToLink');

				_Pager.initPager('pages-to-link', 'Page', 1, 25);
				let linkPagePager = _Pager.addPager('pages-to-link', pagesToLink, true, 'Page', null, (pages) => {

					for (let page of pages) {

						if (page.type !== 'ShadowDocument') {

							let div = Structr.createSingleDOMElementFromHTML(`
								<div class="node page ${_Pages.linkableDialog.nodeClasses}">
									<div class="node-container flex items-center gap-x-2 p-2">
										${_Icons.getSvgIcon('browser-page', 16, 16)}<b title="${escapeForHtmlAttributes(page.name)}" class="name_ abbr-ellipsis abbr-120">${page.name}</b>
									</div>
								</div>
							`);

							pagesToLink.appendChild(div);

							_Pages.linkableDialog.handleLinkableElement(div, entity, page);
						}
					}
				}, undefined, undefined, undefined, true);

				linkPagePager.appendFilterElements('<span style="white-space: nowrap;">Filter: <input type="text" class="filter" data-attribute="name" placeholder="Name"></span>');
				linkPagePager.activateFilterElements();
				linkPagePager.setIsPaused(false);
				linkPagePager.refresh();

				targetNode.append('<h3>Files</h3><div class="linkBox" id="foldersToLink"></div><div class="linkBox" id="filesToLink"></div>');

				let filesToLink   = document.querySelector('#filesToLink');
				let foldersToLink = document.querySelector('#foldersToLink');

				_Pager.initPager('folders-to-link', 'Folder', 1, 25);
				_Pager.forceAddFilters('folders-to-link', 'Folder', { hasParent: false });
				let linkFolderPager = _Pager.addPager('folders-to-link', foldersToLink, true, 'Folder', 'ui', (folders) => {

					for (let folder of folders) {
						_Pages.linkableDialog.appendFolder(entity, foldersToLink, folder);
					}
				}, null, 'id,name,hasParent', undefined, true);

				linkFolderPager.appendFilterElements('<span style="white-space: nowrap;">Filter: <input type="text" class="filter" data-attribute="name" placeholder="Name"></span>');
				linkFolderPager.activateFilterElements();
				linkFolderPager.setIsPaused(false);
				linkFolderPager.refresh();

				_Pager.initPager('files-to-link', 'File', 1, 25);
				let linkFilesPager = _Pager.addPager('files-to-link', filesToLink, true, 'File', 'ui', (files) => {

					for (let file of files) {

						let div = Structr.createSingleDOMElementFromHTML(`
							<div class="node file ${_Pages.linkableDialog.nodeClasses}">
								<div class="node-container flex items-center gap-x-2 p-2">
									${_Icons.getFileIconSVG(file)}<b title="${escapeForHtmlAttributes(file.path)}" class="name_ abbr-ellipsis abbr-120">${file.name}</b>
								</div>
							</div>
						`);

						filesToLink.appendChild(div);

						_Pages.linkableDialog.handleLinkableElement(div, entity, file);
					}
				}, null, 'id,name,contentType,linkingElementsIds,path', undefined, true);

				linkFilesPager.appendFilterElements('<span style="white-space: nowrap;">Filters: <input type="text" class="filter" data-attribute="name" placeholder="Name"><label><input type="checkbox"  class="filter" data-attribute="hasParent"> Include subdirectories</label></span>');
				linkFilesPager.activateFilterElements();
				linkFilesPager.setIsPaused(false);
				linkFilesPager.refresh();
			}

			if (entity.tag === 'img' || entity.tag === 'link' || entity.tag === 'a') {

				targetNode.append('<h3>Images</h3><div class="linkBox" id="imagesToLink"></div>');

				let imagesToLink = document.querySelector('#imagesToLink');

				_Pager.initPager('images-to-link', 'Image', 1, 25);
				let linkImagePager = _Pager.addPager('images-to-link', imagesToLink, false, 'Image', 'ui', (images) => {

					for (let image of images) {

						let div = Structr.createSingleDOMElementFromHTML(`
							<div class="node file ${_Pages.linkableDialog.nodeClasses}" title="${escapeForHtmlAttributes(image.path)}">
								<div class="node-container flex items-center gap-x-2 p-2">
									${_Icons.getImageOrIcon(image)}<b class="name_ abbr-ellipsis abbr-120">${image.name}</b>
								</div>
							</div>
						`);

						imagesToLink.append(div);

						_Pages.linkableDialog.handleLinkableElement(div, entity, image);
					}
				}, null, 'id,name,contentType,linkingElementsIds,path,tnSmall', undefined, true);

				linkImagePager.appendFilterElements('<span style="white-space: nowrap;">Filter: <input type="text" class="filter" data-attribute="name" placeholder="Name"></span>');
				linkImagePager.activateFilterElements();
				linkImagePager.setIsPaused(false);
				linkImagePager.refresh();
			}
		},
		appendFolder: (entityToLinkTo, folderEl, subFolder) => {

			let subFolderEl = Structr.createSingleDOMElementFromHTML(`
				<div class="node folder ${(subFolder.hasParent ? 'sub ' : '')}${_Pages.linkableDialog.nodeClasses}">
					<div class="node-container flex items-center gap-x-2 p-2">
						${_Icons.getSvgIcon('folder-closed-icon', 16, 16)}<b title="${escapeForHtmlAttributes(subFolder.name)}" class="name_ abbr-ellipsis abbr-200">${subFolder.name}</b>
					</div>
				</div>
			`);
			folderEl.appendChild(subFolderEl);

			let nodeContainer = subFolderEl.querySelector('.node-container');

			subFolderEl.addEventListener('click', (e) => {
				e.stopPropagation();
				e.preventDefault();

				let folderIsOpen = _Icons.hasSvgIcon(nodeContainer, 'folder-open-icon');

				if (!folderIsOpen) {

					_Pages.linkableDialog.expandFolder(entityToLinkTo, subFolder, subFolderEl);

				} else {

					for (let node of subFolderEl.querySelectorAll('.node')) {
						node.remove();
					}

					_Icons.updateSvgIconInElement(nodeContainer, 'folder-open-icon', 'folder-closed-icon');
				}

				return false;
			});

			nodeContainer.addEventListener('mouseenter', (e) => {
				nodeContainer.classList.add('nodeHover');
			});
			nodeContainer.addEventListener('mouseleave', (e) => {
				nodeContainer.classList.remove('nodeHover');
			});

		},
		expandFolder: (entityToLinkTo, folder, folderEl) => {

			Command.get(folder.id, 'id,name,hasParent,files,folders', (node) => {

				_Icons.updateSvgIconInElement(folderEl, 'folder-closed-icon', 'folder-open-icon');

				for (let subFolder of node.folders) {
					_Pages.linkableDialog.appendFolder(entityToLinkTo, folderEl, subFolder);
				}

				for (let f of node.files) {

					Command.get(f.id, 'id,name,contentType,linkingElementsIds,path', (file) => {

						let div = Structr.createSingleDOMElementFromHTML(`
							<div class="node file sub ${_Pages.linkableDialog.nodeClasses}">
								<div class="node-container flex items-center gap-x-2 p-2">
									${_Icons.getFileIconSVG(file)}<b title="${escapeForHtmlAttributes(file.path)}" class="name_ abbr-ellipsis abbr-200">${file.name}</b>
								</div>
							</div>
						`);
						folderEl.appendChild(div);

						_Pages.linkableDialog.handleLinkableElement(div, entityToLinkTo, file);
					});
				}
			});
		},
		handleLinkableElement: (div, entityToLinkTo, linkableObject) => {

			if (isIn(entityToLinkTo.id, linkableObject.linkingElementsIds)) {
				div.classList.add('nodeActive');
			}

			div.addEventListener('click', (e) => {

				e.stopPropagation();

				let isActive = div.classList.contains('nodeActive');

				div.closest('.linkable-container')?.querySelector('.node.nodeActive')?.classList.remove('nodeActive');

				if (isActive) {

					Command.setProperty(entityToLinkTo.id, 'linkableId', null);

				} else {

					let attrName = (entityToLinkTo.type === 'Link') ? '_html_href' : '_html_src';

					Command.getProperty(entityToLinkTo.id, attrName, (val) => {
						if (!val || val === '') {
							Command.setProperty(entityToLinkTo.id, attrName, '${link.path}', null);
						}
					});

					Command.link(entityToLinkTo.id, linkableObject.id);

					div.classList.add('nodeActive');
				}

				_Entities.reloadChildren(entityToLinkTo.parent.id);
			});

			div.addEventListener('mouseenter', (e) => {
				div.classList.add('nodeHover');
			});
			div.addEventListener('mouseleave', (e) => {
				div.classList.remove('nodeHover');
			});
		},
	},

	templates: {
		main: config => `
			<link rel="stylesheet" type="text/css" media="screen" href="css/pages.css">

			<div class="column-resizer-blocker"></div>
			<div class="column-resizer column-resizer-left hidden"></div>
			<div class="column-resizer column-resizer-right hidden"></div>

			<div class="slideout-activator left" id="pagesTab">
				<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 28 28" width="24" height="24">
					<g transform="matrix(1,0,0,1,0,0)">
						<path d="M9.750 18.748 L23.250 18.748 L23.250 23.248 L9.750 23.248 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M9.750 11.248 L23.250 11.248 L23.250 15.748 L9.750 15.748 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M0.750 0.748 L14.250 0.748 L14.250 5.248 L0.750 5.248 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M6.75,5.248v1.5a1.5,1.5,0,0,0,1.5,1.5h4.5a1.5,1.5,0,0,1,1.5,1.5v1.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M17.25 15.748L17.25 18.748" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
					</g>
				</svg>
				<br>
				Page Tree
			</div>

			<div id="pages" class="slideOut slideOutLeft">
				<div id="pages-controls">
					<div id="pagesPager">
						<div id="pagesPagerFilters">
							Filters: <input type="text" class="filter" data-attribute="name" placeholder="Name" title="Here you can filter the pages list by page name" autocomplete="new-password"/>
							<input type="text" class="filter page-label category-filter" data-attribute="category" placeholder="Category" />
						</div>
					</div>

					<div id="pages-actions" class="dropdown-menu darker-shadow-dropdown dropdown-menu-large">
						<button class="btn dropdown-select hover:bg-gray-100 focus:border-gray-666 active:border-green">
							${_Icons.getSvgIcon('circle_plus')}
						</button>
						<div class="dropdown-menu-container">

							<div class="flex flex-col divide-x-0 divide-y">
								<a id="create_page" title="Create Page" class="inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green cursor-pointer p-4">
									${_Icons.getSvgIcon('circle_plus', 16, 16, 'mr-2')} Create Page
								</a>

								<a id="import_page" title="Import Template" class="inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green cursor-pointer p-4">
									${_Icons.getSvgIcon('file_add', 16, 16, 'mr-2')} Import Page
								</a>

								<!--a id="add_template" title="Add Template" class="inline-flex items-center hover:bg-gray-100 focus:border-gray-666 active:border-green cursor-pointer p-4">
									${_Icons.getSvgIcon('magic_wand')} Add Template
								</a-->
							</div>
						</div>
					</div>
				</div>
				<div id="pagesTree"></div>
			</div>

			<div class="slideout-activator left" id="localizationsTab">
				<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 28 28" width="24" height="24">
					<g transform="matrix(1,0,0,1,0,0)">
						<path d="M19.652 0.748L15.902 2.998 18.152 6.748" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M23.25,8.187A6.749,6.749,0,0,0,16.366,3.77" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M4.348 23.248L8.098 20.998 5.848 17.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M.75,15.808a6.749,6.749,0,0,0,6.884,4.417" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M0.750 0.748 L12.750 0.748 L12.750 12.748 L0.750 12.748 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M15.75,11.248h6a1.5,1.5,0,0,1,1.5,1.5v9a1.5,1.5,0,0,1-1.5,1.5h-9a1.5,1.5,0,0,1-1.5-1.5v-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M15.75,20.248v-4.5a1.5,1.5,0,0,1,3,0v4.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M15.75 18.748L18.75 18.748" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M6.75 3.748L6.75 5.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M3.75 5.248L9.75 5.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M8.25,5.248s-1.5,4.5-4.5,4.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M6.749,8.014a3.933,3.933,0,0,0,3,1.734" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
					</g>
				</svg>
				<br>
				Trans-<br>lations
			</div>

			<div id="localizations" class="slideOut slideOutLeft">
				<div class="page inner">
					<div class="localizations-inputs flex">
						<select id="localization-preview-page" class="hover:bg-gray-100 focus:border-gray-666 active:border-green"></select>
						<input class="locale" placeholder="Locale">
						<button class="refresh action button flex items-center">${_Icons.getSvgIcon('refresh-arrows', 16, 16, 'mr-2')} Refresh</button>
					</div>

					<div class="results"></div>
				</div>
			</div>

			<div id="center-pane"></div>

			<div class="slideout-activator right" id="widgetsTab">
				<svg viewBox="0 0 28 28" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
					<g transform="matrix(1.1666666666666667,0,0,1.1666666666666667,0,0)">
						<path d="M16.5,23.248H21a.75.75,0,0,0,.75-.75V17.559a.75.75,0,0,0-.219-.53l-1.06-1.061a.749.749,0,0,0-.53-.22H16.5a.75.75,0,0,0-.75.75v6A.75.75,0,0,0,16.5,23.248Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M16.5,9.748H21A.75.75,0,0,0,21.75,9V4.059a.75.75,0,0,0-.219-.53l-1.06-1.061a.749.749,0,0,0-.53-.22H16.5a.75.75,0,0,0-.75.75V9A.75.75,0,0,0,16.5,9.748Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M2.25 0.748L2.25 2.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M2.25 5.248L2.25 8.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M2.25 11.248L2.25 14.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M2.25,17.248v1.5a1.5,1.5,0,0,0,1.5,1.5h1.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M8.25 20.248L11.25 20.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M14.25 20.248L15.75 20.248" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M2.25 6.748L5.25 6.748" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M8.25 6.748L11.25 6.748" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M14.25 6.748L15.75 6.748" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
					</g>
				</svg>
				<br>
				Widgets
			</div>

			<div id="widgetsSlideout" class="slideOut slideOutRight">
			</div>

			<div class="slideout-activator right" id="paletteTab">
				<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
					<g transform="matrix(1.1666666666666667,0,0,1.1666666666666667,0,0)"><g>
						<rect x="0.75" y="0.75" width="22.5" height="22.5" rx="1.5" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></rect>
						<rect x="4.25" y="4.25" width="9.5" height="9.5" rx="0.75" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></rect>
						<rect x="13.25" y="16.25" width="6.5" height="3.5" rx="0.75" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></rect>
						<line x1="4.25" y1="19.75" x2="7.75" y2="19.75" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></line>
						<line x1="4.25" y1="16.75" x2="9.25" y2="16.75" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></line>
						<line x1="4.47" y1="4.47" x2="13.53" y2="13.53" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></line>
						<line x1="13.53" y1="4.47" x2="4.47" y2="13.53" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></line>
						<line x1="19.75" y1="13.25" x2="19.75" y2="4.5" style="fill: none;stroke: currentColor;stroke-linecap: round;stroke-linejoin: round;stroke-width: 1.5px"></line>
					  </g></g></svg>
				<br>Design Tools
			</div>

			<div id="palette" class="slideOut slideOutRight">
				<div id="paletteArea"></div>
			</div>

			<div class="slideout-activator right" id="componentsTab">
				<svg viewBox="0 0 28 28" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
					<g transform="matrix(1.1666666666666667,0,0,1.1666666666666667,0,0)">
						<path d="M6.750 3.001 A5.25 2.25 0 1 0 17.250 3.001 A5.25 2.25 0 1 0 6.750 3.001 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M6.75,3V6c0,1.242,2.351,2.25,5.25,2.25S17.25,7.243,17.25,6V3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M6.75,6V9c0,1.242,2.351,2.25,5.25,2.25S17.25,10.243,17.25,9V6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M0.750 14.251 L9.750 14.251 L9.750 20.251 L0.750 20.251 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M5.25 20.251L5.25 23.251" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M3 23.251L7.5 23.251" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M14.250 14.251 L23.250 14.251 L23.250 20.251 L14.250 20.251 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M18.75 20.251L18.75 23.251" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M16.5 23.251L21 23.251" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M2.251,11.251v-1.5a1.5,1.5,0,0,1,1.5-1.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M21.751,11.251v-1.5a1.5,1.5,0,0,0-1.5-1.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
					</g>
				</svg>
				<br>
				Shared Comp.
			</div>

			<div id="components" class="slideOut slideOutRight">
				<div class="inner"></div>
			</div>

			<div class="slideout-activator right" id="elementsTab">
				<svg viewBox="0 0 28 28" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
					<g transform="matrix(1.1666666666666667,0,0,1.1666666666666667,0,0)">
						<path d="M22.9,1.3A1.5,1.5,0,0,0,21.75.764H2.25A1.5,1.5,0,0,0,.772,2.521l3.387,19.5a1.5,1.5,0,0,0,1.478,1.243H18.363a1.5,1.5,0,0,0,1.478-1.243l3.387-19.5A1.5,1.5,0,0,0,22.9,1.3Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M10.125 13.514L6.375 13.514 6.375 17.264" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M17.792,14.247a5.572,5.572,0,0,1-10.74-.733" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M14.625 10.514L18.375 10.514 18.375 6.764" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M6.958,9.781a5.572,5.572,0,0,1,10.74.733" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
					</g>
				</svg>
				<br>
				Recycle Bin
			</div>

			<div id="elements" class="slideOut slideOutRight">
				<div id="elementsArea"></div>
			</div>
		`,
		functions: config => `
			<div class="flex-grow">
				<ul class="tabs-menu hidden">
					<li id="tabs-menu-basic">
						<a href="#pages:basic">Basic</a>
					</li>
					<li id="tabs-menu-html">
						<a href="#pages:html">HTML</a>
					</li>
					<li id="tabs-menu-advanced">
						<a href="#pages:advanced">Advanced</a>
					</li>
					<li id="tabs-menu-preview">
						<a href="#pages:preview">Preview</a>
					</li>
					<li id="tabs-menu-editor">
						<a href="#pages:editor">Editor</a>
					</li>
					<li id="tabs-menu-repeater">
						<a href="#pages:repeater">Repeater</a>
					</li>
					<li id="tabs-menu-events">
						<a href="#pages:events">Events</a>
					</li>
					<li id="tabs-menu-link">
						<a href="#pages:link">Link</a>
					</li>
					<li id="tabs-menu-security">
						<a href="#pages:security">Security</a>
					</li>
				</ul>
			</div>
		`,
		basic: config => `
			<div class="content-container basic-container"></div>
		`,
		contentEditor: config => `
			<div class="content-container content-editor-container flex flex-col">
				<div class="editor flex-grow"></div>
				<div class="editor-info-container"></div>
				<div class="editor-button-container"></div>
			</div>
		`,
		events: config => `
			<div class="content-container">

				<div class="inline-info">
					<div class="inline-info-icon">
						${_Icons.getSvgIcon('info-icon', 24, 24)}
					</div>
					<div class="inline-info-text">
						Here you can define actions to modify data objects in the backend like create, update or delete.<br><br>
						Actions can be triggered by specific events like clicking on an element, changing a value or select option, or when it's loosing the focus.
					</div>
				</div>

				<div class="events-container"></div>
			</div>
		`,
		preview: config => `
			<div class="content-container preview-container">
				<div class="previewBox" data-id="${config.pageId}">
					<iframe></iframe>
				</div>
			</div>
		`,
		properties: config => `
			<div class="content-container properties-container"></div>
		`,
		repeater: config => `
			<div class="content-container">

				<div class="inline-info">
					<div class="inline-info-icon">
						${_Icons.getSvgIcon('info-icon', 24, 24)}
					</div>
					<div class="inline-info-text">
						A repeater is a node in the tree that is repeatedly displayed for each element of the result set.<br><br>
						The result set is a list or collection of objects that can be generated via a database query, a flow or a function.<br><br>
						The respective result element can be accessed via a keyword configured further below.
					</div>
				</div>

				<div class="flex flex-col h-full repeater-container">
					<h3>Result Collection</h3>

					<div class="query-type-buttons"></div>

					<select class="hidden" id="flow-selector"></select>
					<div class="hidden flex-grow query-text"></div>
					<div>
						<button class="save-repeater-query hover:bg-gray-100 focus:border-gray-666 active:border-green">Save</button>
					</div>

					<div class="my-8">
						<h3>Repeater Keyword</h3>
						<p>
							The repeater keyword or data key is either a word to reference result objects, or it can be the
							name of a collection property of the result object.<br><br>
							You can access result objects or the objects of the collection using template expressions,
							e.g. <i>\${project.name}</i>.
						</p>
						<div>
							<input class="repeater-datakey" type="text" value="">
							<button class="save-repeater-datakey hover:bg-gray-100 focus:border-gray-666 active:border-green">Save</button>
						</div>
					</div>
				</div>
			</div>
		`,
		security: config => `
			<div class="content-container security-container">
				<div class="inline-info">
					<div class="inline-info-icon">
						${_Icons.getSvgIcon('info-icon', 24, 24)}
					</div>
					<div class="inline-info-text">
						The Access Control and Visibility dialog provides access to the security settings of a node. In this dialog, you can set, edit or remove the owner of the node, set visibility flags and configure security relationships.
					</div>
				</div>
			</div>
		`,
		linkable: config => `
			<div class="content-container linkable-container"></div>
		`,
	}
};

function findDiff(str1, str2){
	let diff= "";
	str2.split('').forEach(function(val, i){
		if (val != str1.charAt(i))
			diff += val ;
	});
	return diff;
}

// polyfill for RegExp.escape
if (!RegExp.escape) {
	RegExp.escape = function(s) {
		return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
	};
}

var TopLevelObject = {}
TopLevelObject.DOMNodePathStep = function(value, optimized)
{
	this.value = value;
	this.optimized = optimized || false;
}
TopLevelObject.DOMNodePathStep.prototype = {
	/**
	 * @override
	 * @return {string}
	 */
	toString: function()
	{
		return this.value;
	}
}
TopLevelObject.DOMPresentationUtils = {}

TopLevelObject.DOMPresentationUtils.cssPath = function(node, optimized)
{
	if (node.nodeType !== Node.ELEMENT_NODE)
		return "";
	var steps = [];
	var contextNode = node;
	while (contextNode) {
		var step = TopLevelObject.DOMPresentationUtils._cssPathStep(contextNode, !!optimized, contextNode === node);
		if (!step)
			break; // Error - bail out early.
		steps.push(step);
		if (step.optimized)
			break;
		contextNode = contextNode.parentNode;
	}
	steps.reverse();
	return steps.join(" > ");
}

TopLevelObject.DOMPresentationUtils._cssPathStep = function(node, optimized, isTargetNode)
{
	if (node.nodeType !== Node.ELEMENT_NODE)
		return null;
	var id = node.getAttribute("id");
	if (optimized) {
		if (id)
			return new TopLevelObject.DOMNodePathStep(idSelector(id), true);
		var nodeNameLower = node.nodeName.toLowerCase();
		if (nodeNameLower === "body" || nodeNameLower === "head" || nodeNameLower === "html")
			return new TopLevelObject.DOMNodePathStep(node.tagName.toLowerCase(), true);
	}
	var nodeName = node.tagName.toLowerCase();
	if (id)
		return new TopLevelObject.DOMNodePathStep(nodeName + idSelector(id), true);
	var parent = node.parentNode;
	if (!parent || parent.nodeType === Node.DOCUMENT_NODE)
		return new TopLevelObject.DOMNodePathStep(nodeName, true);
	/**
	 * @param {!TopLevelObject.DOMNode} node
	 * @return {!Array.<string>}
	 */
	function prefixedElementClassNames(node)
	{
		var classAttribute = node.getAttribute("class");
		if (!classAttribute)
			return [];
		return classAttribute.split(/\s+/g).filter(Boolean).map(function(name) {
			// The prefix is required to store "__proto__" in a object-based map.
			return "$" + name;
		});
	}
	/**
	 * @param {string} id
	 * @return {string}
	 */
	function idSelector(id)
	{
		return "#" + escapeIdentifierIfNeeded(id);
	}
	/**
	 * @param {string} ident
	 * @return {string}
	 */
	function escapeIdentifierIfNeeded(ident)
	{
		if (isCSSIdentifier(ident))
			return ident;
		var shouldEscapeFirst = /^(?:[0-9]|-[0-9-]?)/.test(ident);
		var lastIndex = ident.length - 1;
		return ident.replace(/./g, function(c, i) {
			return ((shouldEscapeFirst && i === 0) || !isCSSIdentChar(c)) ? escapeAsciiChar(c, i === lastIndex) : c;
		});
	}
	/**
	 * @param {string} c
	 * @param {boolean} isLast
	 * @return {string}
	 */
	function escapeAsciiChar(c, isLast)
	{
		return "\\" + toHexByte(c) + (isLast ? "" : " ");
	}
	/**
	 * @param {string} c
	 */
	function toHexByte(c)
	{
		var hexByte = c.charCodeAt(0).toString(16);
		if (hexByte.length === 1)
			hexByte = "0" + hexByte;
		return hexByte;
	}
	/**
	 * @param {string} c
	 * @return {boolean}
	 */
	function isCSSIdentChar(c)
	{
		if (/[a-zA-Z0-9_-]/.test(c))
			return true;
		return c.charCodeAt(0) >= 0xA0;
	}
	/**
	 * @param {string} value
	 * @return {boolean}
	 */
	function isCSSIdentifier(value)
	{
		return /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(value);
	}
	var prefixedOwnClassNamesArray = prefixedElementClassNames(node);
	var needsClassNames = false;
	var needsNthChild = false;
	var ownIndex = -1;
	var elementIndex = -1;
	var siblings = parent.children;
	for (var i = 0; (ownIndex === -1 || !needsNthChild) && i < siblings.length; ++i) {
	var sibling = siblings[i];
	if (sibling.nodeType !== Node.ELEMENT_NODE)
		continue;
	elementIndex += 1;
	if (sibling === node) {
		ownIndex = elementIndex;
		continue;
	}
	if (needsNthChild)
		continue;
	if (sibling.tagName.toLowerCase() !== nodeName)
		continue;
	needsClassNames = true;
	var ownClassNames = prefixedOwnClassNamesArray.values();
	var ownClassNameCount = 0;
	for (var name in ownClassNames)
		++ownClassNameCount;
	if (ownClassNameCount === 0) {
		needsNthChild = true;
		continue;
	}
	var siblingClassNamesArray = prefixedElementClassNames(sibling);
	for (var j = 0; j < siblingClassNamesArray.length; ++j) {
		var siblingClass = siblingClassNamesArray[j];
		if (!ownClassNames.hasOwnProperty(siblingClass))
			continue;
		delete ownClassNames[siblingClass];
		if (!-ownClassNameCount) {
			needsNthChild = true;
			break;
		}
	}
}
	var result = nodeName;
	if (isTargetNode && nodeName.toLowerCase() === "input" && node.getAttribute("type") && !node.getAttribute("id") && !node.getAttribute("class"))
		result += "[type=\"" + node.getAttribute("type") + "\"]";
	if (needsNthChild) {
		result += ":nth-child(" + (ownIndex + 1) + ")";
	} else if (needsClassNames) {
		for (var prefixedName in prefixedOwnClassNamesArray.values())
			result += "." + escapeIdentifierIfNeeded(prefixedName.substr(1));
	}
	return new TopLevelObject.DOMNodePathStep(result, false);
}