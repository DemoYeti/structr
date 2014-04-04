package org.structr.schema.importer;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.neo4j.graphdb.Node;

/**
 *
 * @author Christian Morgner
 */
public class TypeInfo {

	private Map<String, Class> propertySet = new LinkedHashMap<>();
	private Set<String> otherTypes         = new LinkedHashSet<>();
	private List<Node> nodes               = new LinkedList<>();
	private String primaryType             = null;
	private int hierarchyLevel             = 0;
	
	public TypeInfo(final String primaryType, final Set<String> otherTypes, final List<Node> nodes) {
		
		this.primaryType = primaryType;
		this.otherTypes.addAll(otherTypes);
		this.otherTypes.remove(primaryType);
		
		this.nodes.addAll(nodes);
	}
	
	@Override
	public int hashCode() {
		return primaryType.hashCode();
	}
	
	@Override
	public boolean equals(Object other) {
		
		if (other instanceof TypeInfo) {
			return ((TypeInfo)other).hashCode() == hashCode();
		}
		
		return false;
	};
	
	@Override
	public String toString() {
		return primaryType + "(" + hierarchyLevel + ") " + propertySet.keySet();
	}
	
	public void registerPropertySet(final Map<String, Class> properties) {
		propertySet.putAll(properties);
	}
	
	public void intersectPropertySets(final Map<String, Class> otherProperties) {
		this.propertySet.keySet().retainAll(otherProperties.keySet());
	}
	
	public Map<String, Class> getPropertySet() {
		return propertySet;
	}
	
	public String getSuperclass(final Map<String, TypeInfo> typeInfos) {
		
		final Map<Integer, TypeInfo> hierarchyMap = new TreeMap<>();

		for (final TypeInfo info : typeInfos.values()) {
			
			final String type = info.getPrimaryType();
			if (otherTypes.contains(type)) {
				
				hierarchyMap.put(info.getHierarchyLevel(), info);
			}
		}
	
		int level          = getHierarchyLevel() + 1;
		TypeInfo superType = hierarchyMap.get(level);
		
		// check all hierarchy levels above ours
		while (superType == null && level < 100) {
			superType = hierarchyMap.get(++level);
		}

		if (superType != null) {
			return superType.getPrimaryType();
		}
		
		return null;
	}

	public boolean hasSuperclass(final String type) {
		return otherTypes.contains(type);
	}
	
	public String getPrimaryType() {
		return primaryType;
	}

	public Set<String> getOtherTypes() {
		return otherTypes;
	}
	
	public List<Node> getNodes() {
		return nodes;
	}

	public int getHierarchyLevel() {
		return hierarchyLevel;
	}

	public void setHierarchyLevel(int level) {
		this.hierarchyLevel = level;
	}
}
