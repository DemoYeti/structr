/*
 *  Copyright (C) 2010-2014 Morgner UG (haftungsbeschränkt)
 *
 *  This file is part of structr <http://structr.org>.
 *
 *  structr is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  structr is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with structr.  If not, see <http://www.gnu.org/licenses/>.
 */

var contents, editor, contentType;

var _Contents = {
    icon: 'icon/page_white.png',
    comment_icon: 'icon/comment.png',
    comp_icon: 'icon/package_green.png',
    template_icon: 'icon/layout_content.png',
    add_icon: 'icon/page_white_add.png',
    delete_icon: 'icon/page_white_delete.png',
    appendContentElement: function(entity, refNode, refNodeIsParent) {
        log('Contents.appendContentElement', entity, refNode);

        var parent;

        if (entity.parent && entity.parent.id) {
            parent = Structr.node(entity.parent.id);
            _Entities.ensureExpanded(parent);
        } else {
            parent = refNode;
        }

        if (!parent)
            return false;

        var isActiveNode = entity.hideOnIndex || entity.hideOnDetail || entity.hideConditions || entity.showConditions || entity.dataKey;
        var isTemplate = (entity.type === 'Template');

        var name = entity.name;

        var isComment = (entity.type === 'Comment');
        var isComponent = entity.sharedComponent || (entity.syncedNodes && entity.syncedNodes.length);
        //console.log('comment, component, template?', isComment, isComponent, isTemplate);
        var icon = isComment ? _Contents.comment_icon : (isComponent ? _Contents.comp_icon : (isTemplate ? _Contents.template_icon : _Contents.icon));
        
        var html = '<div id="id_' + entity.id + '" class="node content ' + (isActiveNode ? ' activeNode' : 'staticNode') + '">'
                + '<img class="typeIcon" src="' + icon + '">'
                + (name ? ('<b title="' + name + '" class="tag_ name_">' + name + '</b>') : ('<div class="content_">' + escapeTags(entity.content) + '</div>'))
                + '<span class="id">' + entity.id + '</span>'
                + '</div>';

        if (refNode && !refNodeIsParent) {
            refNode.before(html);
        } else {
            parent.append(html);
        }

        var div = Structr.node(entity.id);

        _Dragndrop.makeSortable(div);
        _Dragndrop.makeDroppable(div);

        if (isTemplate) {
            var hasChildren = entity.childrenIds && entity.childrenIds.length;
            _Entities.appendExpandIcon(div, entity, hasChildren);
        }
        
        _Entities.appendAccessControlIcon(div, entity);

        div.append('<img title="Delete content \'' + entity.name + '\'" alt="Delete content \'' + entity.name + '\'" class="delete_icon button" src="' + Structr.delete_icon + '">');
        $('.delete_icon', div).on('click', function(e) {
            e.stopPropagation();
            _Entities.deleteNode(this, entity);
        });

        div.append('<img title="Edit Content" alt="Edit Content of ' + (entity.name ? entity.name : entity.id) + '" class="edit_icon button" src="icon/pencil.png">');
        $('.edit_icon', div).on('click', function(e) {
            e.stopPropagation();
            _Contents.openEditContentDialog(this, entity);
            return false;
        });

        $('.content_', div).on('click', function(e) {
            e.stopPropagation();
            _Contents.openEditContentDialog(this, entity);
            return false;
        });

        _Entities.setMouseOver(div, undefined, ((entity.syncedNodes&&entity.syncedNodes.length)?entity.syncedNodes:[entity.sharedComponent]));

        _Entities.appendEditPropertiesIcon(div, entity);

        return div;
    },
    openEditContentDialog: function(btn, entity) {
        Structr.dialog('Edit content of ' + (entity.name ? entity.name : entity.id), function() {
            log('content saved')
        }, function() {
            log('cancelled')
        });
        Command.getProperty(entity.id, 'content', function(text) {
            _Contents.editContent(this, entity, text, dialogText);        
        });
    },
    editContent: function(button, entity, text, element) {
        if (isDisabled(button)) {
            return;
        }
        var div = element.append('<div class="editor"></div>');
        log(div);
        var contentBox = $('.editor', element);
        contentType = contentType ? contentType : entity.contentType;
        var text1, text2;
        
        // Intitialize editor
        editor = CodeMirror(contentBox.get(0), {
            value: text,
            mode: contentType,
            lineNumbers: true
        });
        editor.focus();
        Structr.resize();

        dialogBtn.append('<button id="editorSave" disabled="disabled" class="disabled">Save</button>');
        dialogBtn.append('<button id="saveAndClose" disabled="disabled" class="disabled"> Save and close</button>');

        dialogSaveButton = $('#editorSave', dialogBtn);
        var saveAndClose = $('#saveAndClose', dialogBtn);

        saveAndClose.on('click', function(e) {
            e.stopPropagation();
            dialogSaveButton.click();
            setTimeout(function() {
                dialogSaveButton.remove();
                saveAndClose.remove();
                dialogCancelButton.click();
            }, 500);
        });

        editor.on('change', function(cm, change) {

            if (text === editor.getValue()) {
                dialogSaveButton.prop("disabled", true).addClass('disabled');
                saveAndClose.prop("disabled", true).addClass('disabled');
            } else {
                dialogSaveButton.prop("disabled", false).removeClass('disabled');
                saveAndClose.prop("disabled", false).removeClass('disabled');
            }
        });

        dialogSaveButton.on('click', function(e) {
            e.stopPropagation();

            //var contentNode = Structr.node(entity.id)[0];

            text1 = text;
            text2 = editor.getValue();

            if (!text1)
                text1 = '';
            if (!text2)
                text2 = '';

            if (debug) {
                console.log('Element', contentNode);
                console.log('text1', text1);
                console.log('text2', text2);
            }

            if (text1 === text2) {
                return;
            }
            
            Command.patch(entity.id, text1, text2, function() {
                dialogMsg.html('<div class="infoBox success">Content saved.</div>');
                $('.infoBox', dialogMsg).delay(2000).fadeOut(200);
                _Pages.reloadPreviews();
                dialogSaveButton.prop("disabled", true).addClass('disabled');
                saveAndClose.prop("disabled", true).addClass('disabled');
                Command.getProperty(entity.id, 'content', function(newText) {
                    text = newText;
                });
            });

        });

        //_Entities.appendBooleanSwitch(dialogMeta, entity, 'editable', 'Editable', 'If enabled, data fields in this content element are editable in edit mode.');

        var values = ['text/plain', 'text/html', 'text/css', 'text/javascript', 'text/markdown', 'text/textile', 'text/mediawiki', 'text/tracwiki', 'text/confluence', 'text/asciidoc'];

        dialogMeta.append('<label for="contentTypeSelect">Content-Type:</label><select class="contentType_" id="contentTypeSelect"></select>');
        var select = $('#contentTypeSelect', dialogMeta);
        $.each(values, function(i, type) {
            select.append('<option ' + (type === entity.contentType ? 'selected' : '') + ' value="' + type + '">' + type + '</option>');
        });
        select.on('change', function() {
            contentType = select.val();
            entity.setProperty('contentType', contentType, false, function() {
                _Pages.reloadPreviews();
            });
        });

        editor.id = entity.id;

    }
};